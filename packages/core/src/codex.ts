import { parseMarkdown, serializeMarkdown } from "./frontmatter.js";

/**
 * Codex entities (SPEC §6.2): markdown + typed frontmatter, rendered as
 * designed sheets — never raw frontmatter (§7.4). Built-in types define
 * suggested fields; plugins can register more (§9.2).
 */

export interface EntityFieldDef {
  key: string;
  label: string;
  kind: "text" | "number" | "date" | "list" | "link";
}

export interface EntityTypeDef {
  type: string;
  label: string;
  /** Lucide icon name. */
  icon: string;
  fields: EntityFieldDef[];
}

export const BUILTIN_ENTITY_TYPES: EntityTypeDef[] = [
  {
    type: "character",
    label: "Character",
    icon: "User",
    fields: [
      { key: "age", label: "Age", kind: "number" },
      { key: "pronouns", label: "Pronouns", kind: "text" },
      { key: "role", label: "Role", kind: "text" },
    ],
  },
  {
    type: "place",
    label: "Place",
    icon: "MapPin",
    fields: [{ key: "region", label: "Region", kind: "text" }],
  },
  {
    type: "item",
    label: "Item",
    icon: "Gem",
    fields: [{ key: "significance", label: "Significance", kind: "text" }],
  },
  {
    type: "faction",
    label: "Faction",
    icon: "Flag",
    fields: [{ key: "motto", label: "Motto", kind: "text" }],
  },
  { type: "lore", label: "Lore", icon: "Scroll", fields: [] },
];

export interface ParsedEntity {
  stableId: string | null;
  type: string;
  name: string;
  aliases: string[];
  /** Custom typed fields (frontmatter `fields` object). */
  fields: Record<string, unknown>;
  /** Free-form notes — the markdown body. */
  body: string;
  /** The complete frontmatter, so unrelated keys survive a save. */
  frontmatter: Record<string, unknown>;
}

/** The mention key for an entity name: lowercase first word (`@yuki`). */
export function mentionKeyForName(name: string): string {
  return name.split(/\s+/)[0]?.toLowerCase() ?? "";
}

/** Parse an entity file. Tolerant: missing pieces get gentle defaults. */
export function parseEntity(text: string): ParsedEntity {
  const { data, body } = parseMarkdown(text);
  const name =
    typeof data.name === "string" && data.name.length > 0
      ? data.name
      : "Unnamed";
  return {
    stableId: typeof data.id === "string" ? data.id : null,
    type:
      typeof data.type === "string" && data.type.length > 0
        ? data.type
        : "character",
    name,
    aliases: Array.isArray(data.aliases)
      ? data.aliases.filter((a): a is string => typeof a === "string")
      : [],
    fields:
      typeof data.fields === "object" &&
      data.fields !== null &&
      !Array.isArray(data.fields)
        ? (data.fields as Record<string, unknown>)
        : {},
    body,
    frontmatter: data,
  };
}

/**
 * Serialize an entity back to a file. Unknown frontmatter keys are
 * preserved; the entity's own keys are refreshed; body follows.
 */
export function serializeEntity(entity: ParsedEntity): string {
  const frontmatter: Record<string, unknown> = {
    ...entity.frontmatter,
    type: entity.type,
    name: entity.name,
    aliases: entity.aliases,
    fields: entity.fields,
  };
  if (entity.stableId) {
    frontmatter.id = entity.stableId;
  } else {
    delete frontmatter.id;
  }
  return serializeMarkdown(frontmatter, entity.body);
}
