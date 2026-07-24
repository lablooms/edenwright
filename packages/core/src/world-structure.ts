import type { FileSystemAdapter } from "./adapters/file-system.js";
import { EDEN_WORLD_DIR } from "./model/eden.js";
import { joinPath } from "./paths.js";

/**
 * The one world lives at a fixed subdir of the eden root (one eden = one
 * world): a codex (the entity layer), notes, and maps.
 */

export const WORLD_SUBDIRS = ["codex", "notes", "maps"];

/**
 * Idempotently create `world/{codex,notes,maps}` under the eden root.
 * Runs on every eden open, so a hand-deleted folder heals itself.
 */
export async function ensureWorldDirs(
  fs: FileSystemAdapter,
  edenRoot: string,
): Promise<void> {
  for (const subdir of WORLD_SUBDIRS) {
    await fs.mkdir(joinPath(edenRoot, EDEN_WORLD_DIR, subdir));
  }
}
