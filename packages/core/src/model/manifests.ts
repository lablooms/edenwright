import { EdenwrightError } from "../errors.js";

/**
 * Structured-data manifests (SPEC §6.3). JSON on disk, pretty-printed with
 * stable key order so everything diffs cleanly in git.
 *
 * One eden = one project = one world: `eden.json` is the only manifest a
 * current eden has. The legacy `project.json`/`world.json` shapes survive
 * here solely so `migration.ts` can read pre-collapse edens.
 */

export interface EdenGoals {
  targetWords?: number;
  dailyWords?: number;
}

/** `eden.json` — the one manifest of the one story an eden holds. */
export interface EdenManifest {
  id: string;
  name: string;
  /** Preset id, e.g. "novel", "manga", "feature-film". */
  preset: string;
  /** The preset's medium tag at creation time (denormalized for joins). */
  medium: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Free-form description (carried over from the legacy world on migration). */
  description: string;
  goals: EdenGoals;
  /** Ordered structure-node ids at the root of the story tree. */
  order: string[];
}

/** Legacy `project.json` — read only by the migration path. */
export interface LegacyProjectManifest {
  id: string;
  name: string;
  preset: string;
  medium: string;
  createdAt: string;
  /** World ids this project links, within the same eden. */
  linkedWorlds: string[];
  goals: EdenGoals;
  order: string[];
}

/** Legacy `world.json` — read only by the migration path. */
export interface LegacyWorldManifest {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

function requireString(value: unknown, field: string, file: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new EdenwrightError(
      "MANIFEST_INVALID",
      `${file}: "${field}" must be a non-empty string`,
    );
  }
  return value;
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseGoals(value: unknown): EdenGoals {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;
  const goals: EdenGoals = {};
  if (typeof raw.targetWords === "number") goals.targetWords = raw.targetWords;
  if (typeof raw.dailyWords === "number") goals.dailyWords = raw.dailyWords;
  return goals;
}

/** Parse `eden.json` contents. Throws EdenwrightError on bad shape. */
export function parseEdenManifest(raw: unknown): EdenManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new EdenwrightError(
      "MANIFEST_INVALID",
      "eden.json: expected a JSON object",
    );
  }
  const value = raw as Record<string, unknown>;
  return {
    id: requireString(value.id, "id", "eden.json"),
    name: requireString(value.name, "name", "eden.json"),
    preset: requireString(value.preset, "preset", "eden.json"),
    medium: requireString(value.medium, "medium", "eden.json"),
    createdAt: requireString(value.createdAt, "createdAt", "eden.json"),
    description: optionalString(value.description, ""),
    goals: parseGoals(value.goals),
    order: stringArray(value.order),
  };
}

/** Parse legacy `project.json` contents. Throws EdenwrightError on bad shape. */
export function parseLegacyProjectManifest(
  raw: unknown,
): LegacyProjectManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new EdenwrightError(
      "MANIFEST_INVALID",
      "project.json: expected a JSON object",
    );
  }
  const value = raw as Record<string, unknown>;
  return {
    id: requireString(value.id, "id", "project.json"),
    name: requireString(value.name, "name", "project.json"),
    preset: requireString(value.preset, "preset", "project.json"),
    medium: requireString(value.medium, "medium", "project.json"),
    createdAt: requireString(value.createdAt, "createdAt", "project.json"),
    linkedWorlds: stringArray(value.linkedWorlds),
    goals: parseGoals(value.goals),
    order: stringArray(value.order),
  };
}

/** Parse legacy `world.json` contents. Throws EdenwrightError on bad shape. */
export function parseLegacyWorldManifest(raw: unknown): LegacyWorldManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new EdenwrightError(
      "MANIFEST_INVALID",
      "world.json: expected a JSON object",
    );
  }
  const value = raw as Record<string, unknown>;
  return {
    id: requireString(value.id, "id", "world.json"),
    name: requireString(value.name, "name", "world.json"),
    description: optionalString(value.description, ""),
    createdAt: requireString(value.createdAt, "createdAt", "world.json"),
  };
}

/**
 * Serialize a manifest pretty-printed with stable key order (SPEC §6.3).
 * Key order is the interface field order above — JSON.stringify preserves
 * insertion order for string keys.
 */
export function serializeManifest(manifest: object): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
