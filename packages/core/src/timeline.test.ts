import { describe, expect, it } from "vitest";

import {
  findTimelineCollisions,
  ordinalToStoryDate,
  storyDateToOrdinal,
} from "./timeline.js";

describe("storyDateToOrdinal / ordinalToStoryDate", () => {
  it("orders fictional and real calendars consistently", () => {
    expect(storyDateToOrdinal("1042-03-17")).not.toBeNull();
    expect(storyDateToOrdinal("1042-03-17")!).toBeLessThan(
      storyDateToOrdinal("2024-01-01")!,
    );
    expect(storyDateToOrdinal("1042-03-18")!).toBe(
      storyDateToOrdinal("1042-03-17")! + 1,
    );
  });

  it("round-trips", () => {
    expect(ordinalToStoryDate(storyDateToOrdinal("1042-03-17")!)).toBe(
      "1042-03-17",
    );
    expect(ordinalToStoryDate(storyDateToOrdinal("2024-12-31")!)).toBe(
      "2024-12-31",
    );
  });

  it("rejects junk", () => {
    expect(storyDateToOrdinal("Third Age")).toBeNull();
    expect(storyDateToOrdinal("1042-13-01")).toBeNull();
    expect(storyDateToOrdinal("1042-03-32")).toBeNull();
  });
});

describe("findTimelineCollisions", () => {
  it("flags one entity in two files on the same day", () => {
    const collisions = findTimelineCollisions(
      [
        { path: "a.md", ordinal: 10 },
        { path: "b.md", ordinal: 10 },
        { path: "c.md", ordinal: 11 },
      ],
      new Map([
        ["a.md", ["yuki", "mira"]],
        ["b.md", ["yuki"]],
        ["c.md", ["yuki"]],
      ]),
    );
    expect(collisions).toEqual([
      { entityKey: "yuki", paths: ["a.md", "b.md"] },
    ]);
  });

  it("stays quiet on different days and empty mentions", () => {
    expect(
      findTimelineCollisions(
        [
          { path: "a.md", ordinal: 10 },
          { path: "b.md", ordinal: 11 },
        ],
        new Map([
          ["a.md", ["yuki"]],
          ["b.md", ["yuki"]],
        ]),
      ),
    ).toEqual([]);
  });
});
