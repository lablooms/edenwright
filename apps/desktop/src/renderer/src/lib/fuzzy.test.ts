import { describe, expect, it } from "vitest";

import { fuzzyScore } from "./fuzzy.js";

describe("fuzzyScore", () => {
  it("matches subsequences and rejects non-subsequences", () => {
    expect(fuzzyScore("fox", "the gray fox")).not.toBeNull();
    expect(fuzzyScore("tgf", "the gray fox")).not.toBeNull();
    expect(fuzzyScore("xyz", "the gray fox")).toBeNull();
  });

  it("prefers word-start matches", () => {
    const wordStart = fuzzyScore("gra", "grand hall")!;
    const midWord = fuzzyScore("gra", "integrate")!;
    expect(wordStart).toBeGreaterThan(midWord);
  });

  it("scores empty needles as zero", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
  });
});
