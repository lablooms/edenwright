import { describe, expect, it } from "vitest";

import {
  createEden,
  isEden,
  loadEdenSettings,
  saveEdenSettings,
  validateEdenName,
} from "./eden-structure.js";
import { EdenwrightError } from "./errors.js";
import { DEFAULT_EDEN_SETTINGS } from "./settings.js";
import { InMemoryFileSystemAdapter } from "./testing/in-memory-fs.js";

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
  it("lays down the SPEC §5.5 structure with default settings", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const eden = await createEden(fs, "/home/writer", "Aster Reach");

    expect(eden).toEqual({
      name: "Aster Reach",
      path: "/home/writer/Aster Reach",
    });
    expect(await isEden(fs, eden.path)).toBe(true);
    for (const dir of [
      "Projects",
      "Worlds",
      ".eden/snapshots",
      ".eden/plugins",
      ".eden/themes",
    ]) {
      expect(await fs.exists(`${eden.path}/${dir}`)).toBe(true);
    }
    expect(await loadEdenSettings(fs, eden.path)).toEqual(
      DEFAULT_EDEN_SETTINGS,
    );
  });

  it("refuses a non-empty target folder", async () => {
    const fs = new InMemoryFileSystemAdapter();
    await fs.writeFile("/home/writer/Taken/keep.txt", "mine");
    await expect(createEden(fs, "/home/writer", "Taken")).rejects.toThrow(
      EdenwrightError,
    );
  });
});

describe("loadEdenSettings", () => {
  it("returns defaults without clobbering a corrupt file", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const eden = await createEden(fs, "/e", "Eden");
    await fs.writeFile(`${eden.path}/.eden/settings.json`, "{broken json");
    const settings = await loadEdenSettings(fs, eden.path);
    expect(settings).toEqual(DEFAULT_EDEN_SETTINGS);
    expect(await fs.readFile(`${eden.path}/.eden/settings.json`)).toBe(
      "{broken json",
    );
  });

  it("round-trips saved settings", async () => {
    const fs = new InMemoryFileSystemAdapter();
    const eden = await createEden(fs, "/e", "Eden");
    const custom = {
      ...DEFAULT_EDEN_SETTINGS,
      snapshots: { intervalMinutes: 5, maxTotalBytes: 1024 },
    };
    await saveEdenSettings(fs, eden.path, custom);
    expect(await loadEdenSettings(fs, eden.path)).toEqual(custom);
  });
});
