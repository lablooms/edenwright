import { describe, expect, it } from "vitest";

import { EdenwrightError } from "../errors.js";
import {
  parseProjectManifest,
  parseWorldManifest,
  serializeManifest,
} from "./manifests.js";

const validProject = {
  id: "prj_hollow",
  name: "Hollow Crown",
  preset: "novel",
  medium: "prose",
  createdAt: "2026-07-20T12:00:00.000Z",
  linkedWorlds: ["wld_aster"],
  goals: { targetWords: 90000 },
  order: ["part_1"],
};

describe("parseProjectManifest", () => {
  it("parses a full manifest", () => {
    const manifest = parseProjectManifest(validProject);
    expect(manifest).toEqual({
      ...validProject,
      goals: { targetWords: 90000 },
    });
  });

  it("defaults collections when absent", () => {
    const { linkedWorlds, goals, order, ...rest } = validProject;
    void linkedWorlds;
    void goals;
    void order;
    const manifest = parseProjectManifest(rest);
    expect(manifest.linkedWorlds).toEqual([]);
    expect(manifest.goals).toEqual({});
    expect(manifest.order).toEqual([]);
  });

  it("rejects missing required fields", () => {
    const { medium, ...rest } = validProject;
    void medium;
    expect(() => parseProjectManifest(rest)).toThrow(EdenwrightError);
    expect(() => parseProjectManifest(null)).toThrow(EdenwrightError);
  });
});

describe("parseWorldManifest", () => {
  it("parses and defaults the description", () => {
    const manifest = parseWorldManifest({
      id: "wld_aster",
      name: "Aster Reach",
      createdAt: "2026-07-20T12:00:00.000Z",
    });
    expect(manifest.description).toBe("");
  });

  it("rejects junk", () => {
    expect(() => parseWorldManifest([])).toThrow(EdenwrightError);
  });
});

describe("serializeManifest", () => {
  it("pretty-prints with stable key order and a trailing newline", () => {
    const text = serializeManifest(parseProjectManifest(validProject));
    expect(text.endsWith("\n")).toBe(true);
    expect(text.indexOf('"id"')).toBeLessThan(text.indexOf('"preset"'));
    expect(text.indexOf('"preset"')).toBeLessThan(text.indexOf('"medium"'));
    expect(text).toContain('  "preset": "novel"');
  });
});
