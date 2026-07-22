import { describe, expect, it } from "vitest";

import { createProject, listProjects, projectNameFromPath } from "./project.js";
import { EdenwrightError } from "./errors.js";
import { BUILTIN_PRESETS, findBuiltinPreset } from "./presets.js";
import { InMemoryFileSystemAdapter } from "./testing/in-memory-fs.js";

const NOVEL = findBuiltinPreset("novel")!;

describe("createProject", () => {
  it("lays down the preset scaffold with a valid manifest", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const manifest = await createProject(fs, "/eden", {
      name: "Hollow Crown",
      preset: NOVEL.id,
      medium: NOVEL.medium,
      scaffold: NOVEL.scaffold,
    });

    expect(manifest.id).toMatch(/^prj_[0-9a-z]{8}$/);
    expect(manifest.preset).toBe("novel");
    expect(manifest.medium).toBe("prose");
    expect(manifest.linkedWorlds).toEqual([]);
    for (const dir of ["manuscript", "codex", "notes", "exports"]) {
      expect(await fs.exists(`/eden/Projects/Hollow Crown/${dir}`)).toBe(true);
    }
    const written = JSON.parse(
      await fs.readFile("/eden/Projects/Hollow Crown/project.json"),
    );
    expect(written).toEqual(manifest);
    expect(
      await fs.readFile("/eden/Projects/Hollow Crown/exports/.gitignore"),
    ).toContain("*");
  });

  it("stamps scaffold files with contents (graph.json for interactive)", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const vn = findBuiltinPreset("visual-novel")!;
    await createProject(fs, "/eden", {
      name: "Routes",
      preset: vn.id,
      medium: vn.medium,
      scaffold: vn.scaffold,
    });
    const graph = JSON.parse(
      await fs.readFile("/eden/Projects/Routes/graph.json"),
    );
    expect(graph).toEqual({ nodes: [], edges: [], flags: [] });
  });

  it("refuses a duplicate project folder", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await fs.writeFile("/eden/Projects/Taken/keep.txt", "mine");
    await expect(
      createProject(fs, "/eden", {
        name: "Taken",
        preset: "p",
        medium: "m",
        scaffold: [],
      }),
    ).rejects.toThrow(EdenwrightError);
  });
});

describe("listProjects", () => {
  it("returns valid manifests sorted, skipping non-projects", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await createProject(fs, "/eden", {
      name: "B Book",
      preset: "p",
      medium: "m",
      scaffold: [],
    });
    await createProject(fs, "/eden", {
      name: "A Book",
      preset: "p",
      medium: "m",
      scaffold: [],
    });
    await fs.writeFile("/eden/Projects/random-folder/readme.md", "hi");
    await fs.writeFile("/eden/Projects/broken/project.json", "{nope");

    const projects = await listProjects(fs, "/eden");
    expect(projects.map((project) => project.name)).toEqual([
      "A Book",
      "B Book",
    ]);
  });

  it("returns empty for an eden with no Projects dir", async () => {
    const fs = new InMemoryFileSystemAdapter();
    expect(await listProjects(fs, "/nowhere")).toEqual([]);
  });
});

describe("projectNameFromPath", () => {
  it("finds the owning project folder", () => {
    expect(
      projectNameFromPath("Projects/Hollow Crown/manuscript/scene.md"),
    ).toBe("Hollow Crown");
    expect(projectNameFromPath("Worlds/Aster/notes/history.md")).toBeNull();
    expect(projectNameFromPath("Projects")).toBeNull();
  });
});

describe("builtin presets", () => {
  it("ships ~20 presets across five media, all well-formed", () => {
    expect(BUILTIN_PRESETS.length).toBeGreaterThanOrEqual(19);
    const media = new Set(BUILTIN_PRESETS.map((preset) => preset.medium));
    expect(media).toEqual(
      new Set(["prose", "screenplay", "comic", "interactive", "world"]),
    );
    for (const preset of BUILTIN_PRESETS) {
      expect(preset.id).toMatch(/^[a-z0-9-]+$/);
      expect(preset.terminology.document.length).toBeGreaterThan(0);
      if (preset.home !== "worlds") {
        expect(preset.scaffold.length).toBeGreaterThan(0);
      }
    }
  });
});
