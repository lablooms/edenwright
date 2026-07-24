import { describe, expect, it } from "vitest";

import {
  DEFAULT_EDEN_SETTINGS,
  SNAPSHOT_DEFAULT_INTERVAL_MINUTES,
  SNAPSHOT_DEFAULT_MAX_TOTAL_BYTES,
  parseEdenSettings,
} from "./settings.js";

describe("DEFAULT_EDEN_SETTINGS", () => {
  it("matches the SPEC §5.4 snapshot law (10 min, 500 MB)", () => {
    expect(SNAPSHOT_DEFAULT_INTERVAL_MINUTES).toBe(10);
    expect(SNAPSHOT_DEFAULT_MAX_TOTAL_BYTES).toBe(500 * 1024 * 1024);
    expect(DEFAULT_EDEN_SETTINGS.snapshots.intervalMinutes).toBe(10);
    expect(DEFAULT_EDEN_SETTINGS.snapshots.maxTotalBytes).toBe(
      500 * 1024 * 1024,
    );
  });

  it("defaults to the Literata editor font (SPEC §3.2)", () => {
    expect(DEFAULT_EDEN_SETTINGS.editor.fontFamily).toBe("literata");
  });
});

describe("parseEdenSettings", () => {
  it("returns defaults for junk input", () => {
    expect(parseEdenSettings(undefined)).toEqual(DEFAULT_EDEN_SETTINGS);
    expect(parseEdenSettings("not json")).toEqual(DEFAULT_EDEN_SETTINGS);
    expect(parseEdenSettings(42)).toEqual(DEFAULT_EDEN_SETTINGS);
  });

  it("merges valid partials over defaults", () => {
    const parsed = parseEdenSettings({
      editor: { fontSize: 21 },
      snapshots: { intervalMinutes: 5 },
    });
    expect(parsed.editor.fontSize).toBe(21);
    expect(parsed.editor.fontFamily).toBe("literata");
    expect(parsed.snapshots.intervalMinutes).toBe(5);
    expect(parsed.snapshots.maxTotalBytes).toBe(500 * 1024 * 1024);
  });

  it("fills R4 fields with defaults for pre-R4 settings files", () => {
    // An eden written before the comfort settings existed must load fine.
    const parsed = parseEdenSettings({
      editor: { fontFamily: "literata", fontSize: 17, smartTypography: true },
    });
    expect(parsed.editor.lineWidth).toBe(72);
    expect(parsed.editor.spellcheck).toBe(true);
    expect(parsed.editor.typewriterMode).toBe(false);
  });

  it("drops wrong-typed values back to defaults", () => {
    const parsed = parseEdenSettings({
      editor: { fontSize: "huge" },
      snapshots: { maxTotalBytes: -1 },
    });
    expect(parsed.editor.fontSize).toBe(DEFAULT_EDEN_SETTINGS.editor.fontSize);
    expect(parsed.snapshots.maxTotalBytes).toBe(
      DEFAULT_EDEN_SETTINGS.snapshots.maxTotalBytes,
    );
  });

  it("defaults coreDisabled to empty (core plugins ON) and keeps disables", () => {
    // Pre-R5 settings files have no coreDisabled — everything stays on.
    expect(parseEdenSettings({}).plugins.coreDisabled).toEqual([]);
    const parsed = parseEdenSettings({
      plugins: { coreDisabled: ["lablooms.sprints", 42] },
    });
    expect(parsed.plugins.coreDisabled).toEqual(["lablooms.sprints"]);
  });
});
