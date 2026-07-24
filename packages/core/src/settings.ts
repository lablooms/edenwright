/**
 * Eden settings (`.eden/settings.json`). Defaults are law from SPEC §5.4:
 * snapshot cadence 10 minutes, snapshot cap 500 MB. Parsing is forgiving —
 * a corrupt settings file must never cost the user their eden.
 */

import { DEFAULT_THEME_ID } from "./theme.js";

export const SNAPSHOT_DEFAULT_INTERVAL_MINUTES = 10;
export const SNAPSHOT_DEFAULT_MAX_TOTAL_BYTES = 500 * 1024 * 1024;

/** Bundled editor font choices (SPEC §3.2). */
export type BundledEditorFont =
  "literata" | "space-grotesk" | "jetbrains-mono" | "courier-prime";

export interface EditorSettings {
  /** Bundled font id, or any installed system font family name. */
  fontFamily: BundledEditorFont | (string & {});
  fontSize: number;
  /** Editor line length in ch units — the "line width" comfort slider. */
  lineWidth: number;
  smartTypography: boolean;
  /** Underline misspellings while writing (Electron's built-in checker). */
  spellcheck: boolean;
  /** Keep the line being written vertically centered. */
  typewriterMode: boolean;
}

export interface SnapshotSettings {
  intervalMinutes: number;
  maxTotalBytes: number;
}

/** Plugin enablement and trust (SPEC §9.3). */
export interface PluginSettings {
  /**
   * Master switch for third-party code: silences every folder-installed
   * plugin when true. Core plugins are first-party and stay on (R5).
   */
  restrictedMode: boolean;
  /** Enabled folder-installed plugin ids (.eden/plugins/). */
  enabled: string[];
  /** Plugin ids whose trust dialog was accepted on this eden. */
  trustAcknowledged: string[];
  /**
   * Core (first-party, bundled) plugin ids the user turned off. Core
   * plugins default ON — absence from this list means enabled (R5).
   */
  coreDisabled: string[];
}

/** Theme selection (SPEC §9.5). */
export interface ThemeSettings {
  /** Active theme package id; the default dark theme is the fallback. */
  active: string;
}

export interface EdenSettings {
  editor: EditorSettings;
  snapshots: SnapshotSettings;
  plugins: PluginSettings;
  theme: ThemeSettings;
}

export const DEFAULT_EDEN_SETTINGS: EdenSettings = {
  editor: {
    fontFamily: "literata",
    fontSize: 17,
    lineWidth: 72,
    smartTypography: true,
    spellcheck: true,
    typewriterMode: false,
  },
  snapshots: {
    intervalMinutes: SNAPSHOT_DEFAULT_INTERVAL_MINUTES,
    maxTotalBytes: SNAPSHOT_DEFAULT_MAX_TOTAL_BYTES,
  },
  plugins: {
    restrictedMode: false,
    enabled: [],
    trustAcknowledged: [],
    coreDisabled: [],
  },
  theme: {
    active: DEFAULT_THEME_ID,
  },
};

function pickNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Merge parsed JSON over defaults. Unknown keys are dropped; wrong types fall
 * back to defaults, so a hand-edited or half-written file degrades gracefully.
 */
export function parseEdenSettings(raw: unknown): EdenSettings {
  const source = (raw ?? {}) as Partial<{
    editor: Partial<EditorSettings>;
    snapshots: Partial<SnapshotSettings>;
    plugins: Partial<PluginSettings>;
    theme: Partial<ThemeSettings>;
  }>;

  const editor = source.editor ?? {};
  const snapshots = source.snapshots ?? {};
  const plugins = source.plugins ?? {};
  const theme = source.theme ?? {};

  const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];

  return {
    editor: {
      fontFamily: pickString(
        editor.fontFamily,
        DEFAULT_EDEN_SETTINGS.editor.fontFamily,
      ),
      fontSize: pickNumber(
        editor.fontSize,
        DEFAULT_EDEN_SETTINGS.editor.fontSize,
      ),
      lineWidth: pickNumber(
        editor.lineWidth,
        DEFAULT_EDEN_SETTINGS.editor.lineWidth,
      ),
      smartTypography: pickBoolean(
        editor.smartTypography,
        DEFAULT_EDEN_SETTINGS.editor.smartTypography,
      ),
      spellcheck: pickBoolean(
        editor.spellcheck,
        DEFAULT_EDEN_SETTINGS.editor.spellcheck,
      ),
      typewriterMode: pickBoolean(
        editor.typewriterMode,
        DEFAULT_EDEN_SETTINGS.editor.typewriterMode,
      ),
    },
    snapshots: {
      intervalMinutes: pickNumber(
        snapshots.intervalMinutes,
        DEFAULT_EDEN_SETTINGS.snapshots.intervalMinutes,
      ),
      maxTotalBytes: pickNumber(
        snapshots.maxTotalBytes,
        DEFAULT_EDEN_SETTINGS.snapshots.maxTotalBytes,
      ),
    },
    plugins: {
      restrictedMode: pickBoolean(
        plugins.restrictedMode,
        DEFAULT_EDEN_SETTINGS.plugins.restrictedMode,
      ),
      enabled: stringArray(plugins.enabled),
      trustAcknowledged: stringArray(plugins.trustAcknowledged),
      coreDisabled: stringArray(plugins.coreDisabled),
    },
    theme: {
      active: pickString(theme.active, DEFAULT_EDEN_SETTINGS.theme.active),
    },
  };
}
