/** File-watching capability (SPEC §5.4). Implemented with chokidar in the shell. */

export type WatchEventKind = "add" | "change" | "unlink";

export interface WatchEvent {
  kind: WatchEventKind;
  /** Normalized path of the affected entry. */
  path: string;
  /** What kind of entry changed; omitted when the watcher can't tell. */
  entryKind?: "file" | "directory";
}

export interface WatchOptions {
  /** Directory names to ignore, e.g. [".eden", "exports", ".git"]. */
  ignoreDirs?: string[];
}

export interface WatchHandle {
  close(): Promise<void>;
}

export interface WatcherAdapter {
  /**
   * Watch a directory tree. The callback fires for external edits; the app
   * suppresses events for its own writes (Golden rule 1 — never clobber).
   */
  watch(
    dirPath: string,
    onEvent: (event: WatchEvent) => void,
    options?: WatchOptions,
  ): Promise<WatchHandle>;
}
