/**
 * Theme packages (SPEC §9.5): a folder with `manifest.json` + `theme.css`
 * overriding the §3.1 CSS custom properties. Themes live in `.eden/themes/`
 * and are plain data — no code ever executes from a theme.
 */

export interface ThemeManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export interface InstalledTheme {
  manifest: ThemeManifest;
  /** Raw theme.css contents. */
  css: string;
  /** True for the built-in default (SPEC §9.5: never uninstallable). */
  builtin: boolean;
}

export const DEFAULT_THEME_ID = "edenwright-dark";

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Parse a theme manifest. Returns an error string rather than throwing, so a
 * half-downloaded theme degrades to a skipped entry, never a crashed eden.
 */
export function parseThemeManifest(raw: unknown): ThemeManifest | string {
  if (typeof raw !== "object" || raw === null)
    return "manifest is not an object";
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !ID_RE.test(value.id)) {
    return "manifest.id must be kebab-case";
  }
  if (typeof value.name !== "string" || value.name.length === 0) {
    return "manifest.name is required";
  }
  if (typeof value.version !== "string" || value.version.length === 0) {
    return "manifest.version is required";
  }
  const manifest: ThemeManifest = {
    id: value.id,
    name: value.name,
    version: value.version,
  };
  if (typeof value.description === "string")
    manifest.description = value.description;
  if (typeof value.author === "string") manifest.author = value.author;
  return manifest;
}
