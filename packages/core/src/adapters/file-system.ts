/**
 * Platform capability interfaces — the heart of the Portable Core Law
 * (SPEC §5.3). Core defines; `apps/desktop` implements. Nothing here may
 * import Electron or Node APIs.
 */

export interface FileStat {
  kind: "file" | "directory";
  /** Size in bytes; 0 for directories. */
  size: number;
  /** Last modification time, ms since epoch. */
  modifiedAtMs: number;
}

export interface DirEntry {
  name: string;
  kind: "file" | "directory" | "other";
}

export interface FileSystemAdapter {
  /** Read a UTF-8 text file. Throws EdenwrightError NOT_FOUND when absent. */
  readFile(path: string): Promise<string>;

  /**
   * Write a UTF-8 text file **atomically**: write to a temp sibling, then
   * rename over the target (Golden rule 1 — never a half-written file).
   */
  writeFile(path: string, contents: string): Promise<void>;

  /** Read a binary file (zips, images). Throws NOT_FOUND when absent. */
  readFileBinary(path: string): Promise<Uint8Array>;

  /** Write a binary file atomically (same temp+rename discipline). */
  writeFileBinary(path: string, data: Uint8Array): Promise<void>;

  exists(path: string): Promise<boolean>;

  /** Stat a path, or null when it does not exist. */
  stat(path: string): Promise<FileStat | null>;

  /** Immediate children of a directory, with entry kinds. */
  list(dirPath: string): Promise<DirEntry[]>;

  /** Create a directory and any missing parents. No-op when present. */
  mkdir(path: string): Promise<void>;

  /** Delete a file, or a directory recursively. */
  remove(path: string): Promise<void>;

  /** Rename/move within the same volume. */
  move(fromPath: string, toPath: string): Promise<void>;
}
