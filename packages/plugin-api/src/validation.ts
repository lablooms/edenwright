import type { PluginManifest } from "./manifest.js";

/**
 * Manifest validation (SPEC §9.1, §9.3). The loader calls this before a
 * plugin's code ever runs; the registry CI uses the same checks, so what
 * you test locally is what the community repo enforces.
 */

export type ManifestValidation =
  { ok: true; manifest: PluginManifest } | { ok: false; error: string };

const REQUIRED_STRING_FIELDS = [
  "id",
  "name",
  "version",
  "minAppVersion",
  "description",
  "author",
] as const;

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** Validate a parsed `manifest.json`. Never throws — bad input is data. */
export function validatePluginManifest(raw: unknown): ManifestValidation {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "manifest.json must be a JSON object" };
  }
  const value = raw as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      return {
        ok: false,
        error: `manifest.json: "${field}" must be a non-empty string`,
      };
    }
  }
  if (!SEMVER_RE.test(value.version as string)) {
    return {
      ok: false,
      error: `manifest.json: "version" must be semver (got "${value.version}")`,
    };
  }
  if (!SEMVER_RE.test(value.minAppVersion as string)) {
    return {
      ok: false,
      error: `manifest.json: "minAppVersion" must be semver (got "${value.minAppVersion}")`,
    };
  }
  if (value.authorUrl !== undefined && typeof value.authorUrl !== "string") {
    return {
      ok: false,
      error: 'manifest.json: "authorUrl" must be a string when present',
    };
  }
  if (value.fundingUrl !== undefined && typeof value.fundingUrl !== "string") {
    return {
      ok: false,
      error: 'manifest.json: "fundingUrl" must be a string when present',
    };
  }

  return {
    ok: true,
    manifest: {
      id: value.id as string,
      name: value.name as string,
      version: value.version as string,
      minAppVersion: value.minAppVersion as string,
      description: value.description as string,
      author: value.author as string,
      authorUrl: value.authorUrl as string | undefined,
      fundingUrl: value.fundingUrl as string | undefined,
    },
  };
}

function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Compare two semver strings: negative when a < b, zero when equal, positive when a > b. Pre-release/build suffixes compare by their numeric core. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** True when `have` satisfies `required` (have >= required). */
export function isVersionAtLeast(have: string, required: string): boolean {
  return compareSemver(have, required) >= 0;
}
