import { describe, expect, it } from "vitest";

import { buildFtsQuery } from "./search-query.js";

describe("buildFtsQuery", () => {
  it("wraps each term as a quoted phrase", () => {
    expect(buildFtsQuery("gray fox")).toBe('"gray" "fox"');
  });

  it("escapes embedded quotes", () => {
    expect(buildFtsQuery('the "gray" fox')).toBe('"the" """gray""" "fox"');
  });

  it("returns empty for whitespace-only input", () => {
    expect(buildFtsQuery("   ")).toBe("");
  });
});
