import { useAppStore } from "./store";

/**
 * Update check (SPEC §12 M8): notify-only, never auto-update. One fetch to
 * the GitHub releases API per app start — the second and last sanctioned
 * network call (golden rule 6). Offline, rate-limited, or any failure at
 * all: silence, by design.
 */

const RELEASES_API =
  "https://api.github.com/repos/lablooms/edenwright/releases?per_page=20";
// The releases index — never /latest: seed releases win that redirect.
const RELEASES_PAGE = "https://github.com/lablooms/edenwright/releases";
const FETCH_TIMEOUT_MS = 5000;

/** App releases are tagged v1.2.3(-suffix); seed/plugin releases don't count. */
const APP_TAG_RE = /^v\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i;

let checked = false;

type LatestRelease = { tag: string; newer: boolean };

async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const response = await fetch(RELEASES_API, {
    signal: controller.signal,
    headers: { Accept: "application/vnd.github+json" },
  });
  clearTimeout(timer);
  if (!response.ok) return null;
  const releases = (await response.json()) as { tag_name?: string }[];
  if (!Array.isArray(releases)) return null;
  // Newest first from the API; the first APP-shaped tag is our latest.
  const tag = releases
    .map((release) => release.tag_name)
    .find(
      (candidate) =>
        typeof candidate === "string" && APP_TAG_RE.test(candidate),
    );
  if (!tag) return { tag: "", newer: false };
  const current = await window.edenwright.app.version();
  return { tag, newer: isNewer(tag, current) };
}

/** Manual check (Help menu): reports every outcome, never silently. */
export async function checkForUpdatesManual(): Promise<
  { kind: "latest" } | { kind: "newer"; tag: string } | { kind: "offline" }
> {
  try {
    const latest = await fetchLatestRelease();
    if (latest === null) return { kind: "offline" };
    if (latest.newer) return { kind: "newer", tag: latest.tag };
    return { kind: "latest" };
  } catch {
    return { kind: "offline" };
  }
}

/** The update modal for a newer release (shared by auto + manual paths). */
async function showNewerModal(tag: string): Promise<void> {
  const current = await window.edenwright.app.version();
  const choice = await useAppStore.getState().showModal({
    title: `Edenwright ${tag.replace(/^v/, "")} is out`,
    body: `You're on ${current}. Beta doesn't auto-update — grab the new installer when you're ready; your eden is plain files and goes with you.`,
    actions: [
      { id: "download", label: "Open downloads", primary: true },
      { id: "later", label: "Later" },
    ],
  });
  if (choice === "download") {
    await window.edenwright.app.openExternal(RELEASES_PAGE);
  }
}

export { showNewerModal };

/** Semver-ish compare: true when `candidate` is newer than `current`. */
export function isNewer(candidate: string, current: string): boolean {
  const parse = (version: string) => {
    const [core = "", suffix = ""] = version.replace(/^v/, "").split("-", 2);
    return {
      parts: core.split(".").map((n) => Number.parseInt(n, 10) || 0),
      suffix,
    };
  };
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < 3; i += 1) {
    const diff = (a.parts[i] ?? 0) - (b.parts[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  // Same core: a release outranks its pre-release (0.1.0 > 0.1.0-beta).
  if (a.suffix === b.suffix) return false;
  if (a.suffix === "") return true;
  if (b.suffix === "") return false;
  return a.suffix > b.suffix;
}

export async function checkForUpdates(): Promise<void> {
  if (checked) return;
  checked = true;
  try {
    const latest = await fetchLatestRelease();
    if (latest?.newer) await showNewerModal(latest.tag);
  } catch {
    // Offline, rate-limited, or blocked: fail silently (golden rule 6).
  }
}
