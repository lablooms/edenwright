/**
 * The eden on disk (SPEC §5.5). An eden is one normal folder the user owns —
 * the eden IS the story: one eden = one project = one world. `.eden/` holds
 * everything machine-managed. These names are part of the on-disk contract —
 * changing them is a migration, not a rename.
 */

export const EDEN_META_DIR = ".eden";
export const EDEN_SETTINGS_FILE = "settings.json";
export const EDEN_INDEX_FILE = "index.db";
export const EDEN_SNAPSHOTS_DIR = "snapshots";
export const EDEN_PLUGINS_DIR = "plugins";
export const EDEN_THEMES_DIR = "themes";

export const EDEN_MANIFEST_FILE = "eden.json";
/**
 * First-run orientation note, stamped at the eden root by `createEden` and
 * never re-created — deleting it is a permanent, respectable choice.
 */
export const EDEN_WELCOME_FILE = "welcome.md";
/** The one world, as a fixed subdir holding codex/, notes/, maps/. */
export const EDEN_WORLD_DIR = "world";
export const EDEN_EXPORTS_DIR = "exports";

/**
 * Pre-collapse top-level folders. Referenced only by the legacy-migration
 * path — nothing current may read or write them.
 */
export const LEGACY_PROJECTS_DIR = "Projects";
export const LEGACY_WORLDS_DIR = "Worlds";

/** A located, openable eden. */
export interface EdenInfo {
  /** Display name — the folder name. */
  name: string;
  /** Absolute, normalized path to the eden root folder. */
  path: string;
}

export type {
  EdenManifest,
  LegacyProjectManifest,
  LegacyWorldManifest,
} from "./manifests.js";
