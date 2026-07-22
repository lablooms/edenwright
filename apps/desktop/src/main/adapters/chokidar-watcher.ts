import { basename } from "node:path";

import chokidar from "chokidar";

import type {
  WatchEvent,
  WatchHandle,
  WatchOptions,
  WatcherAdapter,
} from "@edenwright/core";
import { normalizePath } from "@edenwright/core";

/**
 * Watcher over chokidar (SPEC §5.4). Emits normalized paths; initial-scan
 * events are suppressed (the eden service rebuilds the index on open instead,
 * so the watcher only reports what changes *after* that baseline).
 */
export class ChokidarWatcherAdapter implements WatcherAdapter {
  async watch(
    dirPath: string,
    onEvent: (event: WatchEvent) => void,
    options?: WatchOptions,
  ): Promise<WatchHandle> {
    const ignoreDirs = new Set(options?.ignoreDirs ?? []);

    const watcher = chokidar.watch(dirPath, {
      ignoreInitial: true,
      // Atomic writes (temp + rename) surface as a single stable add.
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
      ignored: (path, stats) => {
        if (!stats?.isDirectory()) return false;
        return ignoreDirs.has(basename(path));
      },
    });

    watcher
      .on("add", (path) => {
        onEvent({ kind: "add", path: normalizePath(path), entryKind: "file" });
      })
      .on("change", (path) => {
        onEvent({
          kind: "change",
          path: normalizePath(path),
          entryKind: "file",
        });
      })
      .on("unlink", (path) => {
        onEvent({
          kind: "unlink",
          path: normalizePath(path),
          entryKind: "file",
        });
      })
      .on("addDir", (path) => {
        onEvent({
          kind: "add",
          path: normalizePath(path),
          entryKind: "directory",
        });
      })
      .on("unlinkDir", (path) => {
        onEvent({
          kind: "unlink",
          path: normalizePath(path),
          entryKind: "directory",
        });
      });

    await new Promise<void>((resolve, reject) => {
      watcher.once("ready", () => resolve());
      watcher.once("error", (error) => reject(error));
    });

    return {
      close: async () => {
        await watcher.close();
      },
    };
  }
}
