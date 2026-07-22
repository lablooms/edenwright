import { describe, expect, it } from "vitest";

import { newId } from "./ids.js";

describe("newId", () => {
  it("uses the given prefix and default length", () => {
    expect(newId("scn")).toMatch(/^scn_[0-9a-z]{8}$/);
    expect(newId("ent")).toMatch(/^ent_[0-9a-z]{8}$/);
  });

  it("honors custom lengths", () => {
    expect(newId("nod", 12)).toMatch(/^nod_[0-9a-z]{12}$/);
  });

  it("does not collide in bulk", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId("scn")));
    expect(ids.size).toBe(1000);
  });
});
