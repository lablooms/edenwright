import type { Disposable } from "./disposable.js";

/** File lifecycle events (SPEC §9.2), sourced from the eden watcher. */

export type FileEventKind = "create" | "change" | "delete" | "rename";

export interface FileEvent {
  kind: FileEventKind;
  /** Eden-relative, normalized path. */
  path: string;
  /** Previous path for renames. */
  oldPath?: string;
}

export interface FileEventRegistry {
  on(kind: FileEventKind, callback: (event: FileEvent) => void): Disposable;
}
