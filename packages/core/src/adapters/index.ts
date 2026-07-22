export type { DirEntry, FileStat, FileSystemAdapter } from "./file-system.js";
export type {
  WatchEvent,
  WatchEventKind,
  WatchHandle,
  WatchOptions,
  WatcherAdapter,
} from "./watcher.js";
export type { ConfirmOptions, DialogAdapter, PickOptions } from "./dialogs.js";
export type { ShellAdapter } from "./shell.js";
export type { IndexStorageAdapter } from "./index-storage.js";

import type { DialogAdapter } from "./dialogs.js";
import type { FileSystemAdapter } from "./file-system.js";
import type { IndexStorageAdapter } from "./index-storage.js";
import type { ShellAdapter } from "./shell.js";
import type { WatcherAdapter } from "./watcher.js";

/** Every platform capability core and plugins may touch — nothing else exists. */
export interface PlatformAdapters {
  fs: FileSystemAdapter;
  watcher: WatcherAdapter;
  dialogs: DialogAdapter;
  shell: ShellAdapter;
  index: IndexStorageAdapter;
}
