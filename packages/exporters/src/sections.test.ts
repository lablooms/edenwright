import { describe, expect, it } from "vitest";

import { InMemoryFileSystemAdapter } from "@edenwright/core/testing";

import { collectSections } from "./sections.js";

describe("collectSections", () => {
  it("collects in path order, strips frontmatter, honors custom order", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await fs.writeFile(
      "Projects/H/manuscript/b.md",
      '---\ntitle: "Beta"\nstoryDate: 1042-01-01\n---\nBody B.\n',
    );
    await fs.writeFile(
      "Projects/H/manuscript/a.md",
      '---\ntitle: "Alpha"\n---\nBody A.\n',
    );
    await fs.writeFile("Projects/H/notes/skip.txt", "not markdown");

    const natural = await collectSections(fs, "Projects/H/manuscript");
    expect(natural.map((s) => s.title)).toEqual(["Alpha", "Beta"]);
    expect(natural[1].body).toBe("Body B.\n");
    expect(natural[1].frontmatter.storyDate).toBe("1042-01-01");

    const ordered = await collectSections(fs, "Projects/H/manuscript", [
      "Projects/H/manuscript/b.md",
    ]);
    expect(ordered.map((s) => s.title)).toEqual(["Beta", "Alpha"]);
  });
});
