import { describe, expect, it } from "vitest";

import { resolveLinkTarget, type LinkTargetFile } from "./links.js";

const files: LinkTargetFile[] = [
  {
    path: "Projects/Hollow/manuscript/scene one.md",
    title: "The Long Way Down",
    stableId: "scn_1",
  },
  {
    path: "Projects/Hollow/codex/yuki.md",
    title: "Yuki Harrow",
    stableId: "ent_yuki",
  },
  { path: "Worlds/Aster/notes/history.md", title: "History", stableId: null },
];

describe("resolveLinkTarget", () => {
  it("resolves exact paths with or without extension", () => {
    expect(resolveLinkTarget("Worlds/Aster/notes/history", files)).toBe(
      "Worlds/Aster/notes/history.md",
    );
    expect(resolveLinkTarget("Worlds/Aster/notes/history.md", files)).toBe(
      "Worlds/Aster/notes/history.md",
    );
  });

  it("resolves stable IDs", () => {
    expect(resolveLinkTarget("scn_1", files)).toBe(
      "Projects/Hollow/manuscript/scene one.md",
    );
  });

  it("resolves titles case-insensitively", () => {
    expect(resolveLinkTarget("the long way down", files)).toBe(
      "Projects/Hollow/manuscript/scene one.md",
    );
  });

  it("resolves filename stems", () => {
    expect(resolveLinkTarget("yuki", files)).toBe(
      "Projects/Hollow/codex/yuki.md",
    );
  });

  it("returns null when unresolved", () => {
    expect(resolveLinkTarget("nobody", files)).toBeNull();
    expect(resolveLinkTarget("", files)).toBeNull();
  });
});
