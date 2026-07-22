/**
 * The eden on disk (SPEC §5.5). An eden is one normal folder the user owns;
 * `.eden/` holds everything machine-managed. These names are part of the
 * on-disk contract — changing them is a migration, not a rename.
 */

export const EDEN_META_DIR = ".eden";
export const EDEN_SETTINGS_FILE = "settings.json";
export const EDEN_INDEX_FILE = "index.db";
export const EDEN_SNAPSHOTS_DIR = "snapshots";
export const EDEN_PLUGINS_DIR = "plugins";
export const EDEN_THEMES_DIR = "themes";

export const EDEN_PROJECTS_DIR = "Projects";
export const EDEN_WORLDS_DIR = "Worlds";

/** A located, openable eden. */
export interface EdenInfo {
  /** Display name — the folder name. */
  name: string;
  /** Absolute, normalized path to the eden root folder. */
  path: string;
}

export type { ProjectManifest, WorldManifest } from "./manifests.js";
