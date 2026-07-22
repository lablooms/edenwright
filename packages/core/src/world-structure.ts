import type { FileSystemAdapter } from "./adapters/file-system.js";
import { EdenwrightError } from "./errors.js";
import { newId } from "./ids.js";
import { EDEN_WORLDS_DIR, type WorldManifest } from "./model/eden.js";
import { parseWorldManifest, serializeManifest } from "./model/manifests.js";
import { joinPath } from "./paths.js";
import { validateEdenName } from "./eden-structure.js";

/**
 * Worlds on disk (SPEC §5.5, §8.5): `Worlds/<name>/` with a `world.json`
 * manifest, a codex (the entity layer), notes, and maps. Worlds are the
 * shared-canon containers every project in the eden can link (§7.5).
 */

export const WORLD_SUBDIRS = ["codex", "notes", "maps"];

/**
 * Create `Worlds/<name>/` with its manifest and subfolders. Returns the
 * manifest written to `world.json`.
 */
export async function createWorld(
  fs: FileSystemAdapter,
  edenRoot: string,
  name: string,
): Promise<WorldManifest> {
  const validName = validateEdenName(name);
  const root = joinPath(edenRoot, EDEN_WORLDS_DIR, validName);

  if (await fs.exists(root)) {
    const entries = await fs.list(root);
    if (entries.length > 0) {
      throw new EdenwrightError(
        "IO",
        `"${validName}" already exists as a world folder.`,
      );
    }
  }

  const manifest: WorldManifest = {
    id: newId("wld"),
    name: validName,
    description: "",
    createdAt: new Date().toISOString(),
  };

  for (const subdir of WORLD_SUBDIRS) {
    await fs.mkdir(joinPath(root, subdir));
  }
  await fs.writeFile(joinPath(root, "world.json"), serializeManifest(manifest));
  return manifest;
}

/** Every valid world manifest under `Worlds/`, sorted by name. */
export async function listWorlds(
  fs: FileSystemAdapter,
  edenRoot: string,
): Promise<WorldManifest[]> {
  const worldsDir = joinPath(edenRoot, EDEN_WORLDS_DIR);
  let entries;
  try {
    entries = await fs.list(worldsDir);
  } catch {
    return [];
  }

  const manifests: WorldManifest[] = [];
  for (const entry of entries) {
    if (entry.kind !== "directory") continue;
    try {
      const text = await fs.readFile(
        joinPath(worldsDir, entry.name, "world.json"),
      );
      manifests.push(parseWorldManifest(JSON.parse(text)));
    } catch {
      // Not a world folder.
    }
  }
  manifests.sort((a, b) => a.name.localeCompare(b.name));
  return manifests;
}
