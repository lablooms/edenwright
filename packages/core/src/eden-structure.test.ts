import { describe, expect, it } from "vitest";

import {
  createEden,
  isEden,
  loadEdenManifest,
  loadEdenSettings,
  needsMigration,
  saveEdenManifest,
  saveEdenSettings,
  validateEdenName,
} from "./eden-structure.js";
import { EdenwrightError } from "./errors.js";
import { BUILTIN_PRESETS, findBuiltinPreset } from "./presets.js";
import { DEFAULT_EDEN_SETTINGS } from "./settings.js";
import { InMemoryFileSystemAdapter } from "./testing/in-memory-fs.js";

const NOVEL = findBuiltinPreset("novel")!;

function createNovelEden(
  fs: InMemoryFileSystemAdapter,
  parentDir: string,
  name: string,
) {
  return createEden(fs, parentDir, name, {
    preset: NOVEL.id,
    medium: NOVEL.medium,
    scaffold: NOVEL.scaffold,
  });
}

describe("validateEdenName", () => {
  it("trims and accepts good names", () => {
    expect(validateEdenName("  Aster Reach  ")).toBe("Aster Reach");
  });

  it("rejects empty and illegal names", () => {
    expect(() => validateEdenName("   ")).toThrow(EdenwrightError);
    expect(() => validateEdenName("a/b")).toThrow(EdenwrightError);
    expect(() => validateEdenName("..")).toThrow(EdenwrightError);
  });
});

describe("createEden", () => {
  it("lays down the one-story structure: eden.json, scaffold, world, exports", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const { info, manifest } = await createNovelEden(
      fs,
      "/home/writer",
      "Aster Reach",
    );

    expect(info).toEqual({
      name: "Aster Reach",
      path: "/home/writer/Aster Reach",
    });
    expect(manifest.id).toMatch(/^eden_[0-9a-z]{8}$/);
    expect(manifest.name).toBe("Aster Reach");
    expect(manifest.preset).toBe("novel");
    expect(manifest.medium).toBe("prose");
    expect(manifest.description).toBe("");
    expect(manifest.goals).toEqual({});
    expect(manifest.order).toEqual([]);

    expect(await isEden(fs, info.path)).toBe(true);
    for (const dir of [
      "manuscript",
      "world/codex",
      "world/notes",
      "world/maps",
      "exports",
      ".eden/snapshots",
      ".eden/plugins",
      ".eden/themes",
    ]) {
      expect(await fs.exists(`${info.path}/${dir}`)).toBe(true);
    }
    expect(await fs.readFile(`${info.path}/exports/.gitignore`)).toContain("*");
    // The scaffold stamps at the eden ROOT — no Projects/Worlds anywhere.
    expect(await fs.exists(`${info.path}/Projects`)).toBe(false);
    expect(await fs.exists(`${info.path}/Worlds`)).toBe(false);

    const written = JSON.parse(await fs.readFile(`${info.path}/eden.json`));
    expect(written).toEqual(manifest);
    expect(await loadEdenSettings(fs, info.path)).toEqual(
      DEFAULT_EDEN_SETTINGS,
    );
  });

  it("stamps scaffold files with contents (graph.json for interactive)", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const vn = findBuiltinPreset("visual-novel")!;
    const { info } = await createEden(fs, "/e", "Routes", {
      preset: vn.id,
      medium: vn.medium,
      scaffold: vn.scaffold,
    });
    const graph = JSON.parse(await fs.readFile(`${info.path}/graph.json`));
    expect(graph).toEqual({ nodes: [], edges: [], flags: [] });
  });

  it("carries an optional description into the manifest", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const { manifest } = await createEden(fs, "/e", "Eden", {
      preset: "p",
      medium: "m",
      scaffold: [],
      description: "A quiet story.",
    });
    expect(manifest.description).toBe("A quiet story.");
  });

  it("refuses a non-empty target folder", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await fs.writeFile("/home/writer/Taken/keep.txt", "mine");
    await expect(
      createEden(fs, "/home/writer", "Taken", {
        preset: "p",
        medium: "m",
        scaffold: [],
      }),
    ).rejects.toThrow(EdenwrightError);
  });
});

describe("welcome note", () => {
  it("stamps a preset-flavored welcome.md at the eden root", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const manga = findBuiltinPreset("manga")!;
    const { info } = await createEden(fs, "/e", "Inkfall", {
      preset: manga.id,
      medium: manga.medium,
      scaffold: manga.scaffold,
    });

    const note = await fs.readFile(`${info.path}/welcome.md`);
    expect(note).toContain("# Welcome to Inkfall");
    // The preset's own words: pages, in the pages folder.
    expect(note).toContain("pages");
    expect(note).toContain("**pages** folder");
    expect(note).toContain("**World** tab");
    expect(note).toContain("Writing guide");
  });

  it("falls back to generic wording for unknown (community) presets", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const { info } = await createEden(fs, "/e", "Odd Medium", {
      preset: "community-thing",
      medium: "prose",
      scaffold: [],
    });

    const note = await fs.readFile(`${info.path}/welcome.md`);
    expect(note).toContain("your documents live in whichever folders you make");
  });
});

describe("loadEdenManifest / saveEdenManifest", () => {
  it("round-trips the manifest through eden.json", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const { info, manifest } = await createNovelEden(fs, "/e", "Eden");

    expect(await loadEdenManifest(fs, info.path)).toEqual(manifest);

    const updated = { ...manifest, goals: { targetWords: 90000 } };
    await saveEdenManifest(fs, info.path, updated);
    expect(await loadEdenManifest(fs, info.path)).toEqual(updated);
  });

  it("throws on a missing or invalid manifest", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const { info } = await createNovelEden(fs, "/e", "Eden");
    await expect(loadEdenManifest(fs, "/nowhere")).rejects.toThrow(
      EdenwrightError,
    );
    await fs.writeFile(`${info.path}/eden.json`, '{"id": 42}');
    await expect(loadEdenManifest(fs, info.path)).rejects.toThrow(
      EdenwrightError,
    );
  });
});

describe("needsMigration", () => {
  it("is true only for a pre-collapse eden with Projects/ and no eden.json", async () => {
    const fs = new InMemoryFileSystemAdapter();

    // Not an eden at all.
    expect(await needsMigration(fs, "/plain-folder")).toBe(false);

    // Legacy layout: .eden + Projects, no eden.json.
    await fs.mkdir("/legacy/.eden");
    await fs.mkdir("/legacy/Projects");
    expect(await needsMigration(fs, "/legacy")).toBe(true);

    // Already migrated.
    await fs.writeFile("/legacy/eden.json", "{}");
    expect(await needsMigration(fs, "/legacy")).toBe(false);

    // Fresh eden.
    const { info } = await createNovelEden(fs, "/e", "Fresh");
    expect(await needsMigration(fs, info.path)).toBe(false);
  });
});

describe("loadEdenSettings", () => {
  it("returns defaults without clobbering a corrupt file", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const { info } = await createNovelEden(fs, "/e", "Eden");
    await fs.writeFile(`${info.path}/.eden/settings.json`, "{broken json");
    const settings = await loadEdenSettings(fs, info.path);
    expect(settings).toEqual(DEFAULT_EDEN_SETTINGS);
    expect(await fs.readFile(`${info.path}/.eden/settings.json`)).toBe(
      "{broken json",
    );
  });

  it("round-trips saved settings", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const { info } = await createNovelEden(fs, "/e", "Eden");
    const custom = {
      ...DEFAULT_EDEN_SETTINGS,
      snapshots: { intervalMinutes: 5, maxTotalBytes: 1024 },
    };
    await saveEdenSettings(fs, info.path, custom);
    expect(await loadEdenSettings(fs, info.path)).toEqual(custom);
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
      // Scaffold paths are eden-relative — never absolute, never escaping.
      for (const entry of preset.scaffold) {
        expect(entry.path.startsWith("/")).toBe(false);
        expect(entry.path).not.toContain("..");
      }
    }
  });
});
