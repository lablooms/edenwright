import themesFixture from "../../../../../../registry/community-themes.json";

/**
 * Community themes registry client (SPEC §9.4). The themes panel reads one
 * JSON index; the fetch is one of only two sanctioned network calls (golden
 * rule 7) and falls back to the bundled copy of the registry when offline —
 * the panel is never empty, and failure is always silent.
 *
 * (R5: the plugins half of the old registry client is gone — community
 * plugins are deferred to post-beta; this file is themes-only.)
 */

export interface ThemeRegistryEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  /** "owner/name" — release assets ship from this repo's releases. */
  repo: string;
  /** Tag of the release holding manifest.json + theme.css. */
  releaseTag: string;
  /**
   * First-party seeds ship inside the app — bundled installs work offline
   * and always win over remote entries with the same id.
   */
  bundled?: string;
  screenshots?: string[];
}

export interface ThemeRegistryResult {
  entries: ThemeRegistryEntry[];
  /** "fixture" means the network said no — show the offline hint. */
  source: "remote" | "fixture";
}

const REGISTRY_URL =
  "https://raw.githubusercontent.com/lablooms/edenwright-registry/main/community-themes.json";
const FETCH_TIMEOUT_MS = 5000;

const FIXTURE = themesFixture as { entries: ThemeRegistryEntry[] };

export async function fetchThemeRegistry(): Promise<ThemeRegistryResult> {
  const bundled = FIXTURE.entries.filter((entry) => entry.bundled);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let raw: { entries?: ThemeRegistryEntry[] };
    try {
      const response = await fetch(REGISTRY_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      raw = (await response.json()) as { entries?: ThemeRegistryEntry[] };
    } finally {
      clearTimeout(timer);
    }
    if (!Array.isArray(raw.entries)) throw new Error("bad registry shape");
    // Bundled first-party wins by id — a stale remote can't shadow seeds
    // the app already carries.
    const remote = raw.entries.filter(
      (entry) => !bundled.some((local) => local.id === entry.id),
    );
    return { entries: [...bundled, ...remote], source: "remote" };
  } catch {
    return { entries: FIXTURE.entries, source: "fixture" };
  }
}

/** Direct download URL of one release asset for an entry. */
export function assetUrl(entry: ThemeRegistryEntry, fileName: string): string {
  return `https://github.com/${entry.repo}/releases/download/${entry.releaseTag}/${fileName}`;
}

/**
 * Read one payload file for a registry entry — from the app bundle for
 * first-party seeds (offline by construction), from release assets for
 * third-party entries (SPEC v2 §7).
 */
export async function readThemeAsset(
  entry: ThemeRegistryEntry,
  fileName: string,
): Promise<string> {
  if (entry.bundled) {
    return window.edenwright.app.readBundled(`${entry.bundled}/${fileName}`);
  }
  const response = await fetch(assetUrl(entry, fileName));
  if (!response.ok) {
    throw new Error(
      `${entry.name}: could not download ${fileName} (HTTP ${response.status}).`,
    );
  }
  return response.text();
}

/** Semver-ish compare: 1.10.0 > 1.2.0, suffixes rank below their release. */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) => {
    const [core = "", suffix = ""] = version.split("-", 2);
    return {
      parts: core.split(".").map((n) => Number.parseInt(n, 10) || 0),
      suffix,
    };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa.parts[i] ?? 0) - (pb.parts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.suffix === pb.suffix) return 0;
  if (pa.suffix === "") return 1;
  if (pb.suffix === "") return -1;
  return pa.suffix < pb.suffix ? -1 : 1;
}
