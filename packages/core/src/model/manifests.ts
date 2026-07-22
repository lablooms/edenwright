import { EdenwrightError } from "../errors.js";

/**
 * Structured-data manifests (SPEC §6.3). JSON on disk, pretty-printed with
 * stable key order so everything diffs cleanly in git.
 */

export interface ProjectGoals {
  targetWords?: number;
  dailyWords?: number;
}

/** `project.json` — one work's manifest (SPEC v2 §4.3, §6). */
export interface ProjectManifest {
  id: string;
  name: string;
  /** Preset id, e.g. "novel", "manga", "feature-film". */
  preset: string;
  /** The preset's medium tag at creation time (denormalized for joins). */
  medium: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** World ids this project links, within the same eden. */
  linkedWorlds: string[];
  goals: ProjectGoals;
  /** Ordered structure-node ids at the root of the project tree. */
  order: string[];
}

/** `world.json` — a shared-canon container's manifest. */
export interface WorldManifest {
  id: string;
  name: string;
  description: string;
  /** ISO-8601 creation timestamp. */
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

function parseGoals(value: unknown): ProjectGoals {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;
  const goals: ProjectGoals = {};
  if (typeof raw.targetWords === "number") goals.targetWords = raw.targetWords;
  if (typeof raw.dailyWords === "number") goals.dailyWords = raw.dailyWords;
  return goals;
}

/** Parse `project.json` contents. Throws EdenwrightError on bad shape. */
export function parseProjectManifest(raw: unknown): ProjectManifest {
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

/** Parse `world.json` contents. Throws EdenwrightError on bad shape. */
export function parseWorldManifest(raw: unknown): WorldManifest {
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
