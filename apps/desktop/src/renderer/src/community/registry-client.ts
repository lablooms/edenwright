import pluginsFixture from "../../../../../../registry/community-plugins.json";
import themesFixture from "../../../../../../registry/community-themes.json";

/**
 * Registry client (SPEC §9.4). The community tab reads two JSON indexes;
 * the fetch is one of only two sanctioned network calls (golden rule 6) and
 * falls back to the bundled copy of the registry when offline — the tab is
 * never empty, and failure is always silent.
 */

export interface RegistryEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  /** "owner/name" — release assets ship from this repo's releases. */
  repo: string;
  /** Tag of the release holding manifest.json + payload assets. */
  releaseTag: string;
  /**
   * First-party seeds ship inside the app — bundled installs work offline
   * and always win over remote entries with the same id.
   */
  bundled?: string;
  screenshots?: string[];
}

export interface RegistryResult {
  entries: RegistryEntry[];
  /** "fixture" means the network said no — show the offline hint. */
  source: "remote" | "fixture";
}

export type RegistryKind = "plugins" | "themes";

const REGISTRY_BASE =
  "https://raw.githubusercontent.com/lablooms/edenwright-registry/main";
const FETCH_TIMEOUT_MS = 5000;

const FIXTURES: Record<RegistryKind, { entries: RegistryEntry[] }> = {
  plugins: pluginsFixture,
  themes: themesFixture,
};

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRegistry(
  kind: RegistryKind,
): Promise<RegistryResult> {
  const bundled = FIXTURES[kind].entries.filter((entry) => entry.bundled);
  try {
    const raw = (await fetchJson(
      `${REGISTRY_BASE}/community-${kind}.json`,
    )) as { entries?: RegistryEntry[] };
    if (!Array.isArray(raw.entries)) throw new Error("bad registry shape");
    // Bundled first-party wins by id — a stale remote can't shadow seeds
    // the app already carries.
    const remote = raw.entries.filter(
      (entry) => !bundled.some((local) => local.id === entry.id),
    );
    return { entries: [...bundled, ...remote], source: "remote" };
  } catch {
    return { entries: FIXTURES[kind].entries, source: "fixture" };
  }
}

/** Direct download URL of one release asset for an entry. */
export function assetUrl(entry: RegistryEntry, fileName: string): string {
  return `https://github.com/${entry.repo}/releases/download/${entry.releaseTag}/${fileName}`;
}

/** Download one asset as text; throws on any failure (caller designs the error). */
export async function fetchAssetText(
  entry: RegistryEntry,
  fileName: string,
): Promise<string> {
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
