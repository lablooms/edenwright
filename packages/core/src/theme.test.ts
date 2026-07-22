import { describe, expect, it } from "vitest";

import { parseThemeManifest } from "./theme.js";

describe("parseThemeManifest", () => {
  it("accepts a well-formed manifest", () => {
    const manifest = parseThemeManifest({
      id: "edenwright-light",
      name: "Edenwright Light",
      version: "0.1.0",
      description: "Leaf-green light.",
      author: "Lablooms Studio",
    });
    expect(manifest).toEqual({
      id: "edenwright-light",
      name: "Edenwright Light",
      version: "0.1.0",
      description: "Leaf-green light.",
      author: "Lablooms Studio",
    });
  });

  it("rejects junk with an error string, never a throw", () => {
    expect(typeof parseThemeManifest(null)).toBe("string");
    expect(
      typeof parseThemeManifest({ id: "Bad Id", name: "x", version: "1" }),
    ).toBe("string");
    expect(typeof parseThemeManifest({ id: "ok", version: "1" })).toBe(
      "string",
    );
    expect(typeof parseThemeManifest({ id: "ok", name: "x" })).toBe("string");
  });
});
