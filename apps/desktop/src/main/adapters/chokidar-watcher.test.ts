import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { WatchEvent, WatchHandle } from "@edenwright/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChokidarWatcherAdapter } from "./chokidar-watcher.js";

describe("ChokidarWatcherAdapter", () => {
  let sandbox: string;
  let handle: WatchHandle | null;
  let events: WatchEvent[];

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-watch-"));
    events = [];
    handle = null;
  });

  afterEach(async () => {
    await handle?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  async function startWatching(): Promise<void> {
    handle = await new ChokidarWatcherAdapter().watch(
      sandbox,
      (event) => {
        events.push(event);
      },
      { ignoreDirs: [".eden"] },
    );
  }

  it("reports add, change, and unlink with normalized paths", async () => {
    await startWatching();
    const target = join(sandbox, "scene.md");

    await writeFile(target, "draft one");
    await vi.waitFor(() => {
      expect(events).toContainEqual(
        expect.objectContaining({
          kind: "add",
          path: `${sandbox}/scene.md`.replace(/\\/g, "/"),
        }),
      );
    });

    await writeFile(target, "draft two");
    await vi.waitFor(() => {
      expect(events).toContainEqual(
        expect.objectContaining({
          kind: "change",
          path: `${sandbox}/scene.md`.replace(/\\/g, "/"),
        }),
      );
    });

    await rm(target);
    await vi.waitFor(() => {
      expect(events).toContainEqual(
        expect.objectContaining({
          kind: "unlink",
          path: `${sandbox}/scene.md`.replace(/\\/g, "/"),
        }),
      );
    });
  });

  it("ignores files inside ignored directories", async () => {
    await startWatching();
    await mkdir(join(sandbox, ".eden"), { recursive: true });
    await writeFile(join(sandbox, ".eden", "index.note"), "internal");
    // Give chokidar a fair chance to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(events).toEqual([]);
  });
});
