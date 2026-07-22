import type { FileSystemAdapter } from "./adapters/file-system.js";
import { EdenwrightError } from "./errors.js";
import { newId } from "./ids.js";
import { EDEN_PROJECTS_DIR, type ProjectManifest } from "./model/eden.js";
import { parseProjectManifest, serializeManifest } from "./model/manifests.js";
import { joinPath } from "./paths.js";
import { validateEdenName } from "./eden-structure.js";

/**
 * Projects on disk (SPEC v2 §4.3, §6): a folder in `Projects/` with a
 * `project.json` manifest and the preset's scaffold. Every medium shares
 * this one skeleton — the difference is data, not code.
 */

export interface ScaffoldInput {
  /** Project-relative path (folder when `contents` is omitted). */
  path: string;
  contents?: string;
}

export interface CreateProjectInput {
  name: string;
  /** Preset id, e.g. "novel", "manga". */
  preset: string;
  /** The preset's medium tag, denormalized into the manifest. */
  medium: string;
  /** Folders/files stamped from the preset. */
  scaffold: ScaffoldInput[];
}

const EXPORTS_GITIGNORE =
  "# Generated output (SPEC v2 §4.3) — never commit exports.\n*\n!.gitignore\n";

/**
 * Create `Projects/<name>/` with its manifest and scaffold. Returns the
 * manifest written to `project.json`.
 */
export async function createProject(
  fs: FileSystemAdapter,
  edenRoot: string,
  input: CreateProjectInput,
): Promise<ProjectManifest> {
  const name = validateEdenName(input.name);
  const root = joinPath(edenRoot, EDEN_PROJECTS_DIR, name);

  if (await fs.exists(root)) {
    const entries = await fs.list(root);
    if (entries.length > 0) {
      throw new EdenwrightError(
        "IO",
        `"${name}" already exists as a project folder.`,
      );
    }
  }

  const manifest: ProjectManifest = {
    id: newId("prj"),
    name,
    preset: input.preset,
    medium: input.medium,
    createdAt: new Date().toISOString(),
    linkedWorlds: [],
    goals: {},
    order: [],
  };

  for (const entry of input.scaffold) {
    const target = joinPath(root, entry.path);
    if (entry.contents === undefined) await fs.mkdir(target);
    else await fs.writeFile(target, entry.contents);
  }
  await fs.mkdir(joinPath(root, "exports"));
  await fs.writeFile(
    joinPath(root, "exports", ".gitignore"),
    EXPORTS_GITIGNORE,
  );
  await fs.writeFile(
    joinPath(root, "project.json"),
    serializeManifest(manifest),
  );
  return manifest;
}

/**
 * Every valid project manifest under `Projects/`, sorted by name. Folders
 * with missing or invalid `project.json` are skipped — a half-made folder
 * never breaks the list.
 */
export async function listProjects(
  fs: FileSystemAdapter,
  edenRoot: string,
): Promise<ProjectManifest[]> {
  const projectsDir = joinPath(edenRoot, EDEN_PROJECTS_DIR);
  let entries;
  try {
    entries = await fs.list(projectsDir);
  } catch {
    return [];
  }

  const manifests: ProjectManifest[] = [];
  for (const entry of entries) {
    if (entry.kind !== "directory") continue;
    try {
      const text = await fs.readFile(
        joinPath(projectsDir, entry.name, "project.json"),
      );
      manifests.push(parseProjectManifest(JSON.parse(text)));
    } catch {
      // Not a project folder — a loose directory is allowed to exist.
    }
  }
  manifests.sort((a, b) => a.name.localeCompare(b.name));
  return manifests;
}

/** The project a file belongs to (by `Projects/<name>/` prefix), or null. */
export function projectNameFromPath(relPath: string): string | null {
  const segments = relPath.split("/");
  if (segments.length < 2 || segments[0] !== EDEN_PROJECTS_DIR) return null;
  return segments[1];
}
