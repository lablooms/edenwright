import type { IndexStorageAdapter } from "./adapters/index-storage.js";
import { buildFtsQuery } from "./search-query.js";

/**
 * Read-only index queries used by the shell's query API (and later the
 * plugin API's IndexQueryApi, SPEC §9.2). SQL lives in core; the adapter
 * executes. The FTS snippet markers ⟦ ⟧ delimit matched terms.
 */

export const SNIPPET_OPEN = "⟦";
export const SNIPPET_CLOSE = "⟧";

export interface SearchFilter {
  containerPath?: string;
  kind?: string;
  status?: string;
}

export interface SearchHitRow {
  path: string;
  title: string;
  kind: string;
  container: string;
  snippet: string;
}

export function searchIndex(
  index: IndexStorageAdapter,
  userQuery: string,
  filter: SearchFilter = {},
  limit = 100,
): SearchHitRow[] {
  const ftsQuery = buildFtsQuery(userQuery);
  if (ftsQuery.length === 0) return [];

  const conditions = ["files_fts MATCH ?"];
  const params: unknown[] = [ftsQuery];
  if (filter.containerPath) {
    conditions.push("files.container = ?");
    params.push(filter.containerPath);
  }
  if (filter.kind) {
    conditions.push("files.kind = ?");
    params.push(filter.kind);
  }
  if (filter.status) {
    conditions.push("files.status = ?");
    params.push(filter.status);
  }
  params.push(limit);

  return index.query<SearchHitRow>(
    `SELECT files.path AS path, files.title AS title, files.kind AS kind,
            files.container AS container,
            snippet(files_fts, 2, '${SNIPPET_OPEN}', '${SNIPPET_CLOSE}', ' … ', 12) AS snippet
     FROM files_fts
     JOIN files ON files.path = files_fts.path
     WHERE ${conditions.join(" AND ")}
     ORDER BY rank
     LIMIT ?`,
    params,
  );
}

export interface IndexedFileSummary {
  path: string;
  title: string;
  kind: string;
  wordCount: number;
}

/** Every indexed file — the quick switcher's universe. */
export function listIndexedFiles(
  index: IndexStorageAdapter,
): IndexedFileSummary[] {
  return index
    .query<{ path: string; title: string; kind: string; word_count: number }>(
      "SELECT path, title, kind, word_count FROM files ORDER BY path",
    )
    .map((row) => ({
      path: row.path,
      title: row.title,
      kind: row.kind,
      wordCount: row.word_count,
    }));
}

export interface IndexedEntitySummary {
  path: string;
  name: string;
  stableId: string | null;
  /** Entity type from frontmatter (character, place, …). */
  entityType: string | null;
  aliases: string[];
  /** World name when the entity comes from a world, else null (§7.5). */
  world: string | null;
}

/** Codex entities — the `@` completion's universe. */
export function listIndexedEntities(
  index: IndexStorageAdapter,
): IndexedEntitySummary[] {
  const rows = index.query<{
    path: string;
    title: string;
    stable_id: string | null;
    frontmatter: string;
  }>(
    "SELECT path, title, stable_id, frontmatter FROM files WHERE kind = 'codex' ORDER BY title",
  );

  return rows.map((row) => {
    let entityType: string | null = null;
    let aliases: string[] = [];
    try {
      const frontmatter = JSON.parse(row.frontmatter) as Record<
        string,
        unknown
      >;
      entityType =
        typeof frontmatter.type === "string" ? frontmatter.type : null;
      if (Array.isArray(frontmatter.aliases)) {
        aliases = frontmatter.aliases.filter(
          (alias): alias is string => typeof alias === "string",
        );
      }
    } catch {
      // Corrupt cached frontmatter degrades to a bare entity — the file
      // itself is the truth and will re-derive on next change.
    }
    return {
      path: row.path,
      name: row.title,
      stableId: row.stable_id,
      entityType,
      aliases,
      world: row.path.startsWith("Worlds/")
        ? (row.path.split("/")[1] ?? null)
        : null,
    };
  });
}

/**
 * Entities visible from one project (§7.5): its own codex plus the codices
 * of its linked worlds. World entities carry their world name as a badge.
 */
export function listEntitiesForProject(
  index: IndexStorageAdapter,
  projectName: string,
  linkedWorlds: readonly string[],
): IndexedEntitySummary[] {
  const containers = [
    `Projects/${projectName}`,
    ...linkedWorlds.map((world) => `Worlds/${world}`),
  ];
  const placeholders = containers.map(() => "?").join(", ");
  const rows = index.query<{
    path: string;
    title: string;
    stable_id: string | null;
    frontmatter: string;
  }>(
    `SELECT path, title, stable_id, frontmatter FROM files
     WHERE kind = 'codex' AND container IN (${placeholders})
     ORDER BY title`,
    containers,
  );

  return rows.map((row) => {
    let entityType: string | null = null;
    let aliases: string[] = [];
    try {
      const frontmatter = JSON.parse(row.frontmatter) as Record<
        string,
        unknown
      >;
      entityType =
        typeof frontmatter.type === "string" ? frontmatter.type : null;
      if (Array.isArray(frontmatter.aliases)) {
        aliases = frontmatter.aliases.filter(
          (alias): alias is string => typeof alias === "string",
        );
      }
    } catch {
      // Degrade to a bare entity.
    }
    return {
      path: row.path,
      name: row.title,
      stableId: row.stable_id,
      entityType,
      aliases,
      world: row.path.startsWith("Worlds/")
        ? (row.path.split("/")[1] ?? null)
        : null,
    };
  });
}

/** Backlinks to a target: files whose links mention `targetRaw`. */
export function getBacklinks(
  index: IndexStorageAdapter,
  targetRaw: string,
): { sourcePath: string; kind: string; line: number }[] {
  return index
    .query<{ source_path: string; kind: string; line: number }>(
      "SELECT source_path, kind, line FROM links WHERE target_raw = ? ORDER BY source_path, line",
      [targetRaw],
    )
    .map((row) => ({
      sourcePath: row.source_path,
      kind: row.kind,
      line: row.line,
    }));
}

/** Outgoing links from one file, in document order. */
export function getOutgoingLinks(
  index: IndexStorageAdapter,
  sourcePath: string,
): { targetRaw: string; kind: string; line: number }[] {
  return index
    .query<{ target_raw: string; kind: string; line: number }>(
      "SELECT target_raw, kind, line FROM links WHERE source_path = ? ORDER BY line",
      [sourcePath],
    )
    .map((row) => ({
      targetRaw: row.target_raw,
      kind: row.kind,
      line: row.line,
    }));
}

/** Every file that mentions an entity key, with counts (§7.4 appearances). */
export function getEntityAppearances(
  index: IndexStorageAdapter,
  entityKey: string,
): { path: string; count: number }[] {
  return index
    .query<{ source_path: string; count: number }>(
      "SELECT source_path, count FROM mentions WHERE entity_key = ? ORDER BY count DESC, source_path",
      [entityKey.toLowerCase()],
    )
    .map((row) => ({ path: row.source_path, count: row.count }));
}

/** One indexed file's derivation, or null when unknown. */
export function getIndexedFileInfo(
  index: IndexStorageAdapter,
  path: string,
):
  | (IndexedFileSummary & {
      stableId: string | null;
      frontmatter: Record<string, unknown>;
    })
  | null {
  const rows = index.query<{
    path: string;
    title: string;
    kind: string;
    word_count: number;
    stable_id: string | null;
    frontmatter: string;
  }>(
    "SELECT path, title, kind, word_count, stable_id, frontmatter FROM files WHERE path = ?",
    [path],
  );
  const row = rows[0];
  if (!row) return null;
  let frontmatter: Record<string, unknown> = {};
  try {
    frontmatter = JSON.parse(row.frontmatter) as Record<string, unknown>;
  } catch {
    frontmatter = {};
  }
  return {
    path: row.path,
    title: row.title,
    kind: row.kind,
    wordCount: row.word_count,
    stableId: row.stable_id,
    frontmatter,
  };
}
