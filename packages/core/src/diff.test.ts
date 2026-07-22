import { describe, expect, it } from "vitest";

import { diffLines } from "./diff.js";

describe("diffLines", () => {
  it("marks unchanged files as all same", () => {
    expect(diffLines("a\nb\n", "a\nb\n")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
      { type: "same", text: "" },
    ]);
  });

  it("marks adds and removes around stable context", () => {
    expect(diffLines("a\nb\nc\n", "a\nx\nc\ny\n")).toEqual([
      { type: "same", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "x" },
      { type: "same", text: "c" },
      { type: "add", text: "y" },
      { type: "same", text: "" },
    ]);
  });

  it("handles empty sides", () => {
    expect(diffLines("", "a\n")).toEqual([
      { type: "add", text: "a" },
      { type: "same", text: "" },
    ]);
    expect(diffLines("a\n", "")).toEqual([
      { type: "remove", text: "a" },
      { type: "same", text: "" },
    ]);
  });
});
