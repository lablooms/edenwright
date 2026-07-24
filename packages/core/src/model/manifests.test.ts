import { describe, expect, it } from "vitest";

import { EdenwrightError } from "../errors.js";
import {
  parseEdenManifest,
  parseLegacyProjectManifest,
  parseLegacyWorldManifest,
  serializeManifest,
} from "./manifests.js";

const validEden = {
  id: "eden_hollow",
  name: "Hollow Crown",
  preset: "novel",
  medium: "prose",
  createdAt: "2026-07-20T12:00:00.000Z",
  description: "A quiet story.",
  goals: { targetWords: 90000 },
  order: ["part_1"],
};

const validLegacyProject = {
  id: "prj_hollow",
  name: "Hollow Crown",
  preset: "novel",
  medium: "prose",
  createdAt: "2026-07-20T12:00:00.000Z",
  linkedWorlds: ["wld_aster"],
  goals: { targetWords: 90000 },
  order: ["part_1"],
};

describe("parseEdenManifest", () => {
  it("parses a full manifest", () => {
    expect(parseEdenManifest(validEden)).toEqual(validEden);
  });

  it("defaults description, goals, and order when absent", () => {
    const { description, goals, order, ...rest } = validEden;
    void description;
    void goals;
    void order;
    const manifest = parseEdenManifest(rest);
    expect(manifest.description).toBe("");
    expect(manifest.goals).toEqual({});
    expect(manifest.order).toEqual([]);
  });

  it("rejects missing required fields and junk", () => {
    const { medium, ...rest } = validEden;
    void medium;
    expect(() => parseEdenManifest(rest)).toThrow(EdenwrightError);
    expect(() => parseEdenManifest(null)).toThrow(EdenwrightError);
    expect(() => parseEdenManifest([])).toThrow(EdenwrightError);
  });
});

describe("parseLegacyProjectManifest", () => {
  it("parses a full manifest, keeping linkedWorlds", () => {
    expect(parseLegacyProjectManifest(validLegacyProject)).toEqual(
      validLegacyProject,
    );
  });

  it("defaults collections when absent", () => {
    const { linkedWorlds, goals, order, ...rest } = validLegacyProject;
    void linkedWorlds;
    void goals;
    void order;
    const manifest = parseLegacyProjectManifest(rest);
    expect(manifest.linkedWorlds).toEqual([]);
    expect(manifest.goals).toEqual({});
    expect(manifest.order).toEqual([]);
  });

  it("rejects missing required fields", () => {
    const { medium, ...rest } = validLegacyProject;
    void medium;
    expect(() => parseLegacyProjectManifest(rest)).toThrow(EdenwrightError);
    expect(() => parseLegacyProjectManifest(null)).toThrow(EdenwrightError);
  });
});

describe("parseLegacyWorldManifest", () => {
  it("parses and defaults the description", () => {
    const manifest = parseLegacyWorldManifest({
      id: "wld_aster",
      name: "Aster Reach",
      createdAt: "2026-07-20T12:00:00.000Z",
    });
    expect(manifest.description).toBe("");
  });

  it("rejects junk", () => {
    expect(() => parseLegacyWorldManifest([])).toThrow(EdenwrightError);
  });
});

describe("serializeManifest", () => {
  it("pretty-prints with stable key order and a trailing newline", () => {
    const text = serializeManifest(parseEdenManifest(validEden));
    expect(text.endsWith("\n")).toBe(true);
    expect(text.indexOf('"id"')).toBeLessThan(text.indexOf('"preset"'));
    expect(text.indexOf('"preset"')).toBeLessThan(text.indexOf('"medium"'));
    expect(text).toContain('  "preset": "novel"');
  });
});
