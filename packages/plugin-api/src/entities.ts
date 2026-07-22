import type { Disposable } from "./disposable.js";

/**
 * Codex entity types (SPEC §6.2, §9.2). Built-in types are character, place,
 * item, faction, lore; plugins register new ones here.
 */

export type EntityFieldKind = "text" | "number" | "date" | "list" | "link";

export interface EntityFieldDefinition {
  key: string;
  label: string;
  kind: EntityFieldKind;
  /** Shown as a suggestion, not enforced as required. */
  suggested?: boolean;
}

export interface EntityTypeDefinition {
  /** Type id written to frontmatter, e.g. "character", "vehicle". */
  type: string;
  /** Singular label, plain English. */
  label: string;
  /** Lucide icon name. */
  icon?: string;
  fields: EntityFieldDefinition[];
}

export interface EntityRegistry {
  registerType(type: EntityTypeDefinition): Disposable;
}
