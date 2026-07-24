/**
 * Read-only index queries (SPEC §9.2). The index derives from plain files and
 * is rebuildable; plugins read through here and never write to it.
 */

export interface SearchFilter {
  /** Restrict to one top-level folder of the eden. */
  containerPath?: string;
  /** Filter by frontmatter `status` value. */
  status?: string;
  /** Filter by document kind. */
  kind?: "manuscript" | "codex" | "note";
}

export interface SearchHit {
  path: string;
  /** The file's derived title. */
  title: string;
  /** Document kind: manuscript, codex, or note. */
  kind: string;
  /** Match context with ⟦ ⟧ around hit terms. */
  snippet: string;
}

export type LinkKind = "wiki" | "mention";

export interface LinkRef {
  sourcePath: string;
  /** Resolved target path, or the raw target text when unresolved. */
  target: string;
  kind: LinkKind;
}

export interface AppearanceRef {
  path: string;
  count: number;
}

export interface IndexedFileInfo {
  path: string;
  /** Stable id from frontmatter, when present. */
  id?: string;
  title: string;
  wordCount: number;
  frontmatter: Record<string, unknown>;
}

/** One day's word total for the stats dashboards (§7.8's index table). */
export interface DailyWordCount {
  /** ISO date, YYYY-MM-DD. */
  day: string;
  words: number;
}

/** An entity in the index — codex browser data without the file read. */
export interface IndexedEntity {
  path: string;
  name: string;
  /** Stable id from frontmatter, when present. */
  id?: string;
  type: string;
  aliases: string[];
  /** Legacy world name when the entity lives in an archived world. */
  world?: string;
}

export interface IndexQueryApi {
  searchText(query: string, filter?: SearchFilter): Promise<SearchHit[]>;
  getOutgoingLinks(filePath: string): Promise<LinkRef[]>;
  getBacklinks(filePath: string): Promise<LinkRef[]>;
  getEntityAppearances(entityId: string): Promise<AppearanceRef[]>;
  getFileInfo(path: string): Promise<IndexedFileInfo | null>;
  /** Per-day word totals for a container (top-level folder; "." = whole eden). */
  getDailyWords(containerPath: string, days: number): Promise<DailyWordCount[]>;
  /** All indexed entities, optionally scoped to one container. */
  listEntities(containerPath?: string): Promise<IndexedEntity[]>;
}
