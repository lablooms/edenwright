import type { FileSystemAdapter } from "./adapters/file-system.js";
import { EdenwrightError } from "./errors.js";
import {
  EDEN_META_DIR,
  EDEN_PLUGINS_DIR,
  EDEN_PROJECTS_DIR,
  EDEN_SETTINGS_FILE,
  EDEN_SNAPSHOTS_DIR,
  EDEN_THEMES_DIR,
  EDEN_WORLDS_DIR,
  type EdenInfo,
} from "./model/eden.js";
import { serializeManifest } from "./model/manifests.js";
import { joinPath } from "./paths.js";
import {
  DEFAULT_EDEN_SETTINGS,
  parseEdenSettings,
  type EdenSettings,
} from "./settings.js";

/**
 * Creating and recognizing edens (SPEC §5.5). An eden is one normal folder:
 * Projects/, Worlds/, and a `.eden/` for everything machine-managed.
 */

const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|]/;
const RESERVED_NAMES = new Set([".", ".."]);

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
): Promise<EdenInfo> {
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

  await fs.mkdir(joinPath(root, EDEN_PROJECTS_DIR));
  await fs.mkdir(joinPath(root, EDEN_WORLDS_DIR));
  await fs.mkdir(joinPath(root, EDEN_META_DIR, EDEN_SNAPSHOTS_DIR));
  await fs.mkdir(joinPath(root, EDEN_META_DIR, EDEN_PLUGINS_DIR));
  await fs.mkdir(joinPath(root, EDEN_META_DIR, EDEN_THEMES_DIR));
  await fs.writeFile(
    joinPath(root, EDEN_META_DIR, EDEN_SETTINGS_FILE),
    serializeManifest(DEFAULT_EDEN_SETTINGS),
  );

  return { name: validName, path: root };
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
