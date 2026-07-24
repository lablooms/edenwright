import { describe, expect, it } from "vitest";

import { ensureWorldDirs, WORLD_SUBDIRS } from "./world-structure.js";
import { InMemoryFileSystemAdapter } from "./testing/in-memory-fs.js";

describe("ensureWorldDirs", () => {
  it("creates world/codex|notes|maps under the eden root", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await ensureWorldDirs(fs, "/eden");
    for (const subdir of WORLD_SUBDIRS) {
      expect(await fs.exists(`/eden/world/${subdir}`)).toBe(true);
    }
  });

  it("is idempotent and heals hand-made gaps without touching content", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await fs.writeFile("/eden/world/codex/yuki.md", "# Yuki");
    await ensureWorldDirs(fs, "/eden");
    await ensureWorldDirs(fs, "/eden");

    expect(await fs.readFile("/eden/world/codex/yuki.md")).toBe("# Yuki");
    expect(await fs.exists("/eden/world/notes")).toBe(true);
    expect(await fs.exists("/eden/world/maps")).toBe(true);
  });
});
