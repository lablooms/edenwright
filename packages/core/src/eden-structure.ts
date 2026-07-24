import type { FileSystemAdapter } from "./adapters/file-system.js";
import { EdenwrightError } from "./errors.js";
import { newId } from "./ids.js";
import {
  EDEN_EXPORTS_DIR,
  EDEN_MANIFEST_FILE,
  EDEN_META_DIR,
  EDEN_PLUGINS_DIR,
  EDEN_SETTINGS_FILE,
  EDEN_SNAPSHOTS_DIR,
  EDEN_THEMES_DIR,
  EDEN_WELCOME_FILE,
  LEGACY_PROJECTS_DIR,
  type EdenInfo,
  type EdenManifest,
} from "./model/eden.js";
import { parseEdenManifest, serializeManifest } from "./model/manifests.js";
import { joinPath } from "./paths.js";
import { findBuiltinPreset } from "./presets.js";
import {
  DEFAULT_EDEN_SETTINGS,
  parseEdenSettings,
  type EdenSettings,
} from "./settings.js";
import { ensureWorldDirs } from "./world-structure.js";

/**
 * Creating and recognizing edens. An eden is one normal folder and IS the
 * story: `eden.json` at the root, the preset scaffold stamped beside it,
 * one fixed `world/` for the codex layer, and a `.eden/` for everything
 * machine-managed.
 */

const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|]/;
const RESERVED_NAMES = new Set([".", ".."]);

const EXPORTS_GITIGNORE =
  "# Generated output — never commit exports.\n*\n!.gitignore\n";

/**
 * The first-run note, in the preset's own words ("pages" for a manga,
 * "scenes" for a novel). Plain language for a first-time writer; unknown
 * (community) presets get the generic phrasing.
 */
export function welcomeNoteContents(
  input: CreateEdenInput,
  edenName: string,
): string {
  const preset = findBuiltinPreset(input.preset);
  const documents = (
    preset?.terminology.documents ?? "documents"
  ).toLowerCase();
  const homeId = preset?.structure[0]?.id;
  const homePhrase = homeId
    ? `the **${homeId}** folder`
    : "whichever folders you make";

  return (
    `# Welcome to ${edenName}\n` +
    `\n` +
    `This eden is one ordinary folder on your computer — everything in it is\n` +
    `plain files you own, readable by anything, safe to back up anywhere.\n` +
    `\n` +
    `- The file tree on the left is your story: your ${documents} live in ${homePhrase}.\n` +
    `- The **World** tab keeps your world's people, places, and lore close while you write.\n` +
    `- Everything saves as you go, and **History** keeps earlier versions within reach.\n` +
    `\n` +
    `When you're ready, **Help → Writing guide** has a short, friendly tour.\n`
  );
}

export interface ScaffoldInput {
  /** Eden-relative path (folder when `contents` is omitted). */
  path: string;
  contents?: string;
}

export interface CreateEdenInput {
  /** Preset id, e.g. "novel", "manga". */
  preset: string;
  /** The preset's medium tag, denormalized into the manifest. */
  medium: string;
  /** Folders/files stamped from the preset, at the eden root. */
  scaffold: ScaffoldInput[];
  description?: string;
}

/** Trim and validate an eden (folder) name; throws EdenwrightError when bad. */
export function validateEdenName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new EdenwrightError("IO", "An eden needs a name.");
  }
  if (RESERVED_NAMES.has(trimmed) || ILLEGAL_NAME_CHARS.test(trimmed)) {
    throw new EdenwrightError(
      "IO",
      `The name "${trimmed}" won't work as a folder on every OS — avoid \\ / : * ? " < > |`,
    );
  }
  return trimmed;
}

/**
 * Create a new eden at `<parentDir>/<name>` and lay down its structure.
 * The target must not already be a non-empty folder.
 */
export async function createEden(
  fs: FileSystemAdapter,
  parentDir: string,
  name: string,
  input: CreateEdenInput,
): Promise<{ info: EdenInfo; manifest: EdenManifest }> {
  const validName = validateEdenName(name);
  const root = joinPath(parentDir, validName);

  if (await fs.exists(root)) {
    const entries = await fs.list(root);
    if (entries.length > 0) {
      throw new EdenwrightError(
        "IO",
        `"${root}" already exists and isn't empty. Pick another name or folder.`,
      );
    }
  }

  const manifest: EdenManifest = {
    id: newId("eden"),
    name: validName,
    preset: input.preset,
    medium: input.medium,
    createdAt: new Date().toISOString(),
    description: input.description ?? "",
    goals: {},
    order: [],
  };

  for (const entry of input.scaffold) {
    const target = joinPath(root, entry.path);
    if (entry.contents === undefined) await fs.mkdir(target);
    else await fs.writeFile(target, entry.contents);
  }
  await fs.writeFile(
    joinPath(root, EDEN_WELCOME_FILE),
    welcomeNoteContents(input, validName),
  );
  await ensureWorldDirs(fs, root);
  await fs.mkdir(joinPath(root, EDEN_EXPORTS_DIR));
  await fs.writeFile(
    joinPath(root, EDEN_EXPORTS_DIR, ".gitignore"),
    EXPORTS_GITIGNORE,
  );
  await fs.mkdir(joinPath(root, EDEN_META_DIR, EDEN_SNAPSHOTS_DIR));
  await fs.mkdir(joinPath(root, EDEN_META_DIR, EDEN_PLUGINS_DIR));
  await fs.mkdir(joinPath(root, EDEN_META_DIR, EDEN_THEMES_DIR));
  await fs.writeFile(
    joinPath(root, EDEN_META_DIR, EDEN_SETTINGS_FILE),
    serializeManifest(DEFAULT_EDEN_SETTINGS),
  );
  await fs.writeFile(
    joinPath(root, EDEN_MANIFEST_FILE),
    serializeManifest(manifest),
  );

  return { info: { name: validName, path: root }, manifest };
}

/** True when `path` looks like an eden root (has a `.eden` folder). */
export async function isEden(
  fs: FileSystemAdapter,
  path: string,
): Promise<boolean> {
  const meta = await fs.stat(joinPath(path, EDEN_META_DIR));
  return meta?.kind === "directory";
}

/**
 * True when `path` is a pre-collapse eden: recognized as an eden but still
 * laid out as `Projects/` + `Worlds/` without an `eden.json`.
 */
export async function needsMigration(
  fs: FileSystemAdapter,
  root: string,
): Promise<boolean> {
  if (!(await isEden(fs, root))) return false;
  if (await fs.exists(joinPath(root, EDEN_MANIFEST_FILE))) return false;
  const legacyProjects = await fs.stat(joinPath(root, LEGACY_PROJECTS_DIR));
  return legacyProjects?.kind === "directory";
}

/** Load and parse `eden.json`. Throws when missing or invalid. */
export async function loadEdenManifest(
  fs: FileSystemAdapter,
  root: string,
): Promise<EdenManifest> {
  const text = await fs.readFile(joinPath(root, EDEN_MANIFEST_FILE));
  return parseEdenManifest(JSON.parse(text));
}

/** Persist the eden manifest (atomic write, like every file write). */
export async function saveEdenManifest(
  fs: FileSystemAdapter,
  root: string,
  manifest: EdenManifest,
): Promise<void> {
  await fs.writeFile(
    joinPath(root, EDEN_MANIFEST_FILE),
    serializeManifest(manifest),
  );
}

/**
 * Load `.eden/settings.json`. Missing file → defaults are written back.
 * Corrupt JSON → defaults, and the broken file is left untouched (never
 * clobber anything the user might fix by hand).
 */
export async function loadEdenSettings(
  fs: FileSystemAdapter,
  edenRoot: string,
): Promise<EdenSettings> {
  const settingsPath = joinPath(edenRoot, EDEN_META_DIR, EDEN_SETTINGS_FILE);
  let text: string;
  try {
    text = await fs.readFile(settingsPath);
  } catch {
    await fs.writeFile(settingsPath, serializeManifest(DEFAULT_EDEN_SETTINGS));
    return DEFAULT_EDEN_SETTINGS;
  }

  try {
    return parseEdenSettings(JSON.parse(text));
  } catch {
    return DEFAULT_EDEN_SETTINGS;
  }
}

/** Persist settings (atomic write, like every file write). */
export async function saveEdenSettings(
  fs: FileSystemAdapter,
  edenRoot: string,
  settings: EdenSettings,
): Promise<void> {
  await fs.writeFile(
    joinPath(edenRoot, EDEN_META_DIR, EDEN_SETTINGS_FILE),
    serializeManifest(settings),
  );
}
