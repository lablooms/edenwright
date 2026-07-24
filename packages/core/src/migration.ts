import type { DirEntry, FileSystemAdapter } from "./adapters/file-system.js";
import { validateEdenName } from "./eden-structure.js";
import {
  EDEN_MANIFEST_FILE,
  EDEN_META_DIR,
  EDEN_PLUGINS_DIR,
  EDEN_SETTINGS_FILE,
  EDEN_SNAPSHOTS_DIR,
  EDEN_THEMES_DIR,
  EDEN_WORLD_DIR,
  LEGACY_PROJECTS_DIR,
  LEGACY_WORLDS_DIR,
  type EdenManifest,
  type LegacyProjectManifest,
  type LegacyWorldManifest,
} from "./model/eden.js";
import {
  parseLegacyProjectManifest,
  parseLegacyWorldManifest,
  serializeManifest,
} from "./model/manifests.js";
import { basename, dirname, extname, joinPath } from "./paths.js";
import { DEFAULT_EDEN_SETTINGS } from "./settings.js";
import { WORLD_SUBDIRS } from "./world-structure.js";

/**
 * Collapse a pre-redesign eden (`Projects/` + `Worlds/`) into the new shape
 * where the eden folder IS the story. Golden rule 1 drives the whole design:
 * manifests are backed up before anything moves, moves are same-volume
 * renames, a multi-project eden is COPIED into new sibling edens and the
 * original is only renamed to `<name>-legacy` — never deleted.
 */

export interface LegacyMigrationReport {
  /** Edens that resulted from the migration (one for in-place, N for splits). */
  converted: { name: string; path: string }[];
  /**
   * Where the pre-migration truth survives: `.eden/migration-backup` for an
   * in-place collapse, the renamed `-legacy` folder for a split.
   */
  legacyBackupPath: string;
}

interface LegacyProjectOnDisk {
  dirName: string;
  manifest: LegacyProjectManifest;
}

interface LegacyWorldOnDisk {
  dirName: string;
  manifest: LegacyWorldManifest;
}

const LEGACY_PROJECT_MANIFEST = "project.json";
const LEGACY_WORLD_MANIFEST = "world.json";
const MIGRATION_BACKUP_DIR = "migration-backup";

async function readLegacyProjects(
  fs: FileSystemAdapter,
  edenRoot: string,
): Promise<LegacyProjectOnDisk[]> {
  const projectsDir = joinPath(edenRoot, LEGACY_PROJECTS_DIR);
  let entries: DirEntry[];
  try {
    entries = await fs.list(projectsDir);
  } catch {
    return [];
  }
  const projects: LegacyProjectOnDisk[] = [];
  for (const entry of entries) {
    if (entry.kind !== "directory") continue;
    try {
      const text = await fs.readFile(
        joinPath(projectsDir, entry.name, LEGACY_PROJECT_MANIFEST),
      );
      projects.push({
        dirName: entry.name,
        manifest: parseLegacyProjectManifest(JSON.parse(text)),
      });
    } catch {
      // A loose or half-made folder never breaks the migration.
    }
  }
  projects.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  return projects;
}

async function readLegacyWorlds(
  fs: FileSystemAdapter,
  edenRoot: string,
): Promise<LegacyWorldOnDisk[]> {
  const worldsDir = joinPath(edenRoot, LEGACY_WORLDS_DIR);
  let entries: DirEntry[];
  try {
    entries = await fs.list(worldsDir);
  } catch {
    return [];
  }
  const worlds: LegacyWorldOnDisk[] = [];
  for (const entry of entries) {
    if (entry.kind !== "directory") continue;
    try {
      const text = await fs.readFile(
        joinPath(worldsDir, entry.name, LEGACY_WORLD_MANIFEST),
      );
      worlds.push({
        dirName: entry.name,
        manifest: parseLegacyWorldManifest(JSON.parse(text)),
      });
    } catch {
      // Not a world folder.
    }
  }
  worlds.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  return worlds;
}

/** Copy every legacy manifest into `.eden/migration-backup/` before moving. */
async function backupLegacyManifests(
  fs: FileSystemAdapter,
  edenRoot: string,
  projects: readonly LegacyProjectOnDisk[],
  worlds: readonly LegacyWorldOnDisk[],
): Promise<string> {
  const backupRoot = joinPath(edenRoot, EDEN_META_DIR, MIGRATION_BACKUP_DIR);
  for (const project of projects) {
    const rel = joinPath(
      LEGACY_PROJECTS_DIR,
      project.dirName,
      LEGACY_PROJECT_MANIFEST,
    );
    await fs.writeFile(
      joinPath(backupRoot, rel),
      await fs.readFile(joinPath(edenRoot, rel)),
    );
  }
  for (const world of worlds) {
    const rel = joinPath(
      LEGACY_WORLDS_DIR,
      world.dirName,
      LEGACY_WORLD_MANIFEST,
    );
    await fs.writeFile(
      joinPath(backupRoot, rel),
      await fs.readFile(joinPath(edenRoot, rel)),
    );
  }
  return backupRoot;
}

/** `scene.md` → `scene-2.md`; `notes` → `notes-2`. */
function suffixedName(name: string, n: number): string {
  const ext = extname(name);
  const stem = ext ? name.slice(0, name.length - ext.length) : name;
  return `${stem}-${n}${ext}`;
}

/** First non-existing path for `name` inside `dir`, suffixing on collision. */
async function firstFreePath(
  fs: FileSystemAdapter,
  dir: string,
  name: string,
): Promise<string> {
  let candidate = joinPath(dir, name);
  for (let n = 2; await fs.exists(candidate); n += 1) {
    candidate = joinPath(dir, suffixedName(name, n));
  }
  return candidate;
}

async function copyTree(
  fs: FileSystemAdapter,
  srcDir: string,
  destDir: string,
): Promise<void> {
  await fs.mkdir(destDir);
  for (const entry of await fs.list(srcDir)) {
    const src = joinPath(srcDir, entry.name);
    const dest = joinPath(destDir, entry.name);
    if (entry.kind === "directory") await copyTree(fs, src, dest);
    else if (entry.kind === "file") {
      // Binary-safe copy — a cover image must survive byte for byte.
      await fs.writeFileBinary(dest, await fs.readFileBinary(src));
    }
  }
}

type TreeOp = "move" | "copy";

/**
 * Place one entry into `destDir`, merging into an existing same-named
 * directory and renaming on a file collision (`<base>-2.md`) — a merge may
 * never overwrite user content.
 */
async function mergeEntryInto(
  fs: FileSystemAdapter,
  src: string,
  destDir: string,
  entry: DirEntry,
  op: TreeOp,
): Promise<void> {
  await fs.mkdir(destDir);
  const dest = joinPath(destDir, entry.name);
  const destStat = await fs.stat(dest);
  if (entry.kind === "directory" && destStat?.kind === "directory") {
    for (const child of await fs.list(src)) {
      await mergeEntryInto(fs, joinPath(src, child.name), dest, child, op);
    }
    if (op === "move") await fs.remove(src);
    return;
  }
  const target = destStat ? await firstFreePath(fs, destDir, entry.name) : dest;
  if (op === "move") {
    await fs.move(src, target);
  } else if (entry.kind === "directory") {
    await copyTree(fs, src, target);
  } else if (entry.kind === "file") {
    await fs.writeFileBinary(target, await fs.readFileBinary(src));
  }
}

async function mergeDirInto(
  fs: FileSystemAdapter,
  srcDir: string,
  destDir: string,
  op: TreeOp,
): Promise<void> {
  let entries: DirEntry[];
  try {
    entries = await fs.list(srcDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    await mergeEntryInto(fs, joinPath(srcDir, entry.name), destDir, entry, op);
  }
}

/** Merge a legacy world's codex/notes/maps into the eden's fixed `world/`. */
async function mergeWorldInto(
  fs: FileSystemAdapter,
  worldDir: string,
  edenRoot: string,
  op: TreeOp,
): Promise<void> {
  for (const subdir of WORLD_SUBDIRS) {
    await mergeDirInto(
      fs,
      joinPath(worldDir, subdir),
      joinPath(edenRoot, EDEN_WORLD_DIR, subdir),
      op,
    );
  }
}

/** Worlds a project links (by id); a lone world is adopted when unlinked. */
function pickLinkedWorlds(
  project: LegacyProjectManifest | null,
  worlds: readonly LegacyWorldOnDisk[],
): LegacyWorldOnDisk[] {
  if (!project) return worlds.length === 1 ? [...worlds] : [];
  const linked = worlds.filter((world) =>
    project.linkedWorlds.includes(world.manifest.id),
  );
  if (linked.length === 0 && worlds.length === 1) return [...worlds];
  return linked;
}

/** The project's manifest re-homed as `eden.json`: no linkedWorlds, + description. */
function toEdenManifest(
  project: LegacyProjectManifest,
  description: string,
): EdenManifest {
  return {
    id: project.id,
    name: project.name,
    preset: project.preset,
    medium: project.medium,
    createdAt: project.createdAt,
    description,
    goals: project.goals,
    order: project.order,
  };
}

/** Move the single project's contents (minus project.json) up to the root. */
async function collapseProjectInPlace(
  fs: FileSystemAdapter,
  edenRoot: string,
  project: LegacyProjectOnDisk,
): Promise<void> {
  const projectDir = joinPath(edenRoot, LEGACY_PROJECTS_DIR, project.dirName);
  for (const entry of await fs.list(projectDir)) {
    if (entry.kind === "file" && entry.name === LEGACY_PROJECT_MANIFEST) {
      continue;
    }
    await mergeEntryInto(
      fs,
      joinPath(projectDir, entry.name),
      edenRoot,
      entry,
      "move",
    );
  }
}

async function migrateInPlace(
  fs: FileSystemAdapter,
  edenRoot: string,
  project: LegacyProjectOnDisk | null,
  worlds: readonly LegacyWorldOnDisk[],
  backupRoot: string,
): Promise<LegacyMigrationReport> {
  const linked = pickLinkedWorlds(project?.manifest ?? null, worlds);
  const extras = worlds.filter((world) => !linked.includes(world));

  if (project) {
    // eden.json lands before any source file disappears (crash-safe order).
    await fs.writeFile(
      joinPath(edenRoot, EDEN_MANIFEST_FILE),
      serializeManifest(
        toEdenManifest(project.manifest, linked[0]?.manifest.description ?? ""),
      ),
    );
    await collapseProjectInPlace(fs, edenRoot, project);
  }

  for (const world of linked) {
    await mergeWorldInto(
      fs,
      joinPath(edenRoot, LEGACY_WORLDS_DIR, world.dirName),
      edenRoot,
      "move",
    );
  }
  // Unlinked worlds are archived whole — nothing the user wrote is lost.
  for (const world of extras) {
    const archiveRoot = joinPath(edenRoot, EDEN_WORLD_DIR, "archived-worlds");
    await fs.mkdir(archiveRoot);
    await fs.move(
      joinPath(edenRoot, LEGACY_WORLDS_DIR, world.dirName),
      await firstFreePath(fs, archiveRoot, world.dirName),
    );
  }

  if (await fs.exists(joinPath(edenRoot, LEGACY_PROJECTS_DIR))) {
    await fs.remove(joinPath(edenRoot, LEGACY_PROJECTS_DIR));
  }
  if (await fs.exists(joinPath(edenRoot, LEGACY_WORLDS_DIR))) {
    await fs.remove(joinPath(edenRoot, LEGACY_WORLDS_DIR));
  }

  return {
    converted: [{ name: basename(edenRoot), path: edenRoot }],
    legacyBackupPath: backupRoot,
  };
}

/** `<eden> — <project>`, falling back to dashes for illegal characters. */
function siblingEdenName(edenName: string, projectName: string): string {
  const candidate = `${edenName} — ${projectName}`;
  try {
    return validateEdenName(candidate);
  } catch {
    return validateEdenName(candidate.replace(/[\\/:*?"<>|]/g, "-"));
  }
}

async function copyFreshMeta(
  fs: FileSystemAdapter,
  fromRoot: string,
  toRoot: string,
): Promise<void> {
  await fs.mkdir(joinPath(toRoot, EDEN_META_DIR, EDEN_SNAPSHOTS_DIR));
  await fs.mkdir(joinPath(toRoot, EDEN_META_DIR, EDEN_PLUGINS_DIR));
  await fs.mkdir(joinPath(toRoot, EDEN_META_DIR, EDEN_THEMES_DIR));
  let settings: string;
  try {
    settings = await fs.readFile(
      joinPath(fromRoot, EDEN_META_DIR, EDEN_SETTINGS_FILE),
    );
  } catch {
    settings = serializeManifest(DEFAULT_EDEN_SETTINGS);
  }
  await fs.writeFile(
    joinPath(toRoot, EDEN_META_DIR, EDEN_SETTINGS_FILE),
    settings,
  );
}

async function migrateToSiblingEdens(
  fs: FileSystemAdapter,
  edenRoot: string,
  projects: readonly LegacyProjectOnDisk[],
  worlds: readonly LegacyWorldOnDisk[],
): Promise<LegacyMigrationReport> {
  const edenName = basename(edenRoot);
  const parentDir = dirname(edenRoot);
  const converted: { name: string; path: string }[] = [];

  for (const project of projects) {
    const newRoot = await firstFreePath(
      fs,
      parentDir,
      siblingEdenName(edenName, project.manifest.name),
    );
    const linked = pickLinkedWorlds(project.manifest, worlds);

    await copyFreshMeta(fs, edenRoot, newRoot);
    await fs.writeFile(
      joinPath(newRoot, EDEN_MANIFEST_FILE),
      serializeManifest(
        toEdenManifest(project.manifest, linked[0]?.manifest.description ?? ""),
      ),
    );

    const projectDir = joinPath(edenRoot, LEGACY_PROJECTS_DIR, project.dirName);
    for (const entry of await fs.list(projectDir)) {
      if (entry.kind === "file" && entry.name === LEGACY_PROJECT_MANIFEST) {
        continue;
      }
      await mergeEntryInto(
        fs,
        joinPath(projectDir, entry.name),
        newRoot,
        entry,
        "copy",
      );
    }
    for (const world of linked) {
      await mergeWorldInto(
        fs,
        joinPath(edenRoot, LEGACY_WORLDS_DIR, world.dirName),
        newRoot,
        "copy",
      );
    }
    converted.push({ name: basename(newRoot), path: newRoot });
  }

  // The original stays fully intact under a new name — the ultimate backup.
  const legacyPath = await firstFreePath(fs, parentDir, `${edenName}-legacy`);
  await fs.move(edenRoot, legacyPath);
  return { converted, legacyBackupPath: legacyPath };
}

/**
 * Migrate a pre-collapse eden to the one-eden-one-story layout. A
 * single-project eden collapses in place; a multi-project eden splits into
 * one new sibling eden per project and the original is renamed to
 * `<name>-legacy`, untouched.
 */
export async function migrateLegacyEden(
  fs: FileSystemAdapter,
  edenRoot: string,
): Promise<LegacyMigrationReport> {
  const projects = await readLegacyProjects(fs, edenRoot);
  const worlds = await readLegacyWorlds(fs, edenRoot);
  const backupRoot = await backupLegacyManifests(
    fs,
    edenRoot,
    projects,
    worlds,
  );

  if (projects.length <= 1) {
    return migrateInPlace(
      fs,
      edenRoot,
      projects[0] ?? null,
      worlds,
      backupRoot,
    );
  }
  return migrateToSiblingEdens(fs, edenRoot, projects, worlds);
}
