import { describe, expect, it } from "vitest";

import { planSnapshotPruning, snapshotFileName } from "./snapshot-policy.js";

const snap = (name: string, sizeBytes: number, createdAtMs: number) => ({
  name,
  sizeBytes,
  createdAtMs,
});

describe("planSnapshotPruning", () => {
  it("keeps everything under the cap", () => {
    expect(
      planSnapshotPruning([snap("a.zip", 100, 1), snap("b.zip", 100, 2)], 1000),
    ).toEqual([]);
  });

  it("prunes oldest-first once over the cap", () => {
    const toDelete = planSnapshotPruning(
      [
        snap("old.zip", 400, 1),
        snap("mid.zip", 400, 2),
        snap("new.zip", 400, 3),
      ],
      500,
    );
    expect(toDelete).toEqual(["old.zip", "mid.zip"]);
  });

  it("never deletes the newest snapshot, even past the cap", () => {
    expect(planSnapshotPruning([snap("huge.zip", 10_000, 1)], 500)).toEqual([]);
  });
});

describe("snapshotFileName", () => {
  it("is colon-free, millisecond-precise, and sortable", () => {
    expect(snapshotFileName(new Date(2026, 6, 21, 1, 2, 3, 456))).toBe(
      "snapshot-2026-07-21T01-02-03-456.zip",
    );
  });

  it("does not collide within one second", () => {
    const a = new Date(2026, 6, 21, 1, 2, 3, 100);
    const b = new Date(2026, 6, 21, 1, 2, 3, 900);
    expect(snapshotFileName(a)).not.toBe(snapshotFileName(b));
  });
});
