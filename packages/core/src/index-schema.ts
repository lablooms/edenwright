/**
 * The index schema (SPEC §5.4). The SQLite database at `.eden/index.db` is a
 * disposable cache of derivations — deleting it costs nothing, it rebuilds
 * from plain files. Core owns the SQL; the shell adapter only executes it.
 */

export const INDEX_SCHEMA_VERSION = "2";

export const INDEX_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  container TEXT NOT NULL,
  kind TEXT NOT NULL,
  stable_id TEXT,
  title TEXT NOT NULL,
  status TEXT,
  story_date TEXT,
  word_count INTEGER NOT NULL,
  frontmatter TEXT NOT NULL,
  mtime_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_container ON files(container);
CREATE INDEX IF NOT EXISTS idx_files_stable_id ON files(stable_id);

CREATE TABLE IF NOT EXISTS links (
  source_path TEXT NOT NULL,
  target_raw TEXT NOT NULL,
  kind TEXT NOT NULL,
  line INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_path);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_raw);

CREATE TABLE IF NOT EXISTS mentions (
  source_path TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mentions_entity ON mentions(entity_key);

CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
  path UNINDEXED,
  title,
  body
);

-- Per-day word totals per container (goals & streaks, §7.8). A derivation
-- like everything else here: rebuilt from files, never the truth.
CREATE TABLE IF NOT EXISTS daily_words (
  day TEXT NOT NULL,
  container TEXT NOT NULL,
  words INTEGER NOT NULL,
  PRIMARY KEY (day, container)
);
`;

export interface FileRow {
  path: string;
  container: string;
  kind: string;
  stable_id: string | null;
  title: string;
  status: string | null;
  story_date: string | null;
  word_count: number;
  frontmatter: string;
  mtime_ms: number;
}

export interface LinkRow {
  source_path: string;
  target_raw: string;
  kind: string;
  line: number;
}

export interface MentionRow {
  source_path: string;
  entity_key: string;
  count: number;
}
