import { describe, expect, it } from "vitest";

import { InMemoryFileSystemAdapter } from "./testing/in-memory-fs.js";
import { walkFiles } from "./walk.js";

describe("walkFiles", () => {
  it("collects matching files recursively, sorted, skipping ignored dirs", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await fs.writeFile("/eden/Projects/H/chapter.md", "a");
    await fs.writeFile("/eden/Projects/H/codex/yuki.md", "b");
    await fs.writeFile("/eden/Projects/H/cover.png", "c");
    await fs.writeFile("/eden/.eden/settings.json", "{}");
    await fs.writeFile("/eden/Projects/H/exports/out.docx", "d");

    const found = await walkFiles(fs, "/eden", {
      ignoreDirs: [".eden", "exports"],
      extensions: [".md"],
    });
    expect(found).toEqual([
      "/eden/Projects/H/chapter.md",
      "/eden/Projects/H/codex/yuki.md",
    ]);
  });

  it("returns empty for a missing root", async () => {
    const fs = new InMemoryFileSystemAdapter();
    expect(await walkFiles(fs, "/nope")).toEqual([]);
  });
});
