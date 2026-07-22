import { describe, expect, it } from "vitest";

import { createWorld, listWorlds } from "./world-structure.js";
import { EdenwrightError } from "./errors.js";
import { InMemoryFileSystemAdapter } from "./testing/in-memory-fs.js";

describe("createWorld", () => {
  it("lays down the SPEC §5.5 world structure with a valid manifest", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const manifest = await createWorld(fs, "/eden", "Aster Reach");

    expect(manifest.id).toMatch(/^wld_[0-9a-z]{8}$/);
    for (const dir of ["codex", "notes", "maps"]) {
      expect(await fs.exists(`/eden/Worlds/Aster Reach/${dir}`)).toBe(true);
    }
    const written = JSON.parse(
      await fs.readFile("/eden/Worlds/Aster Reach/world.json"),
    );
    expect(written).toEqual(manifest);
  });

  it("refuses a duplicate world folder", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await fs.writeFile("/eden/Worlds/Taken/keep.txt", "mine");
    await expect(createWorld(fs, "/eden", "Taken")).rejects.toThrow(
      EdenwrightError,
    );
  });
});

describe("listWorlds", () => {
  it("returns valid manifests sorted, skipping non-worlds", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await createWorld(fs, "/eden", "B World");
    await createWorld(fs, "/eden", "A World");
    await fs.writeFile("/eden/Worlds/random/readme.md", "hi");

    const worlds = await listWorlds(fs, "/eden");
    expect(worlds.map((world) => world.name)).toEqual(["A World", "B World"]);
  });

  it("returns empty without a Worlds dir", async () => {
    const fs = new InMemoryFileSystemAdapter();
    expect(await listWorlds(fs, "/nowhere")).toEqual([]);
  });
});
