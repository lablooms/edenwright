import type { FileSystemAdapter } from "./adapters/file-system.js";
import type { IndexStorageAdapter } from "./adapters/index-storage.js";
import { deriveFile, kindFromPath } from "./file-model.js";
import { INDEX_SCHEMA_SQL, INDEX_SCHEMA_VERSION } from "./index-schema.js";
import { EDEN_WELCOME_FILE } from "./model/eden.js";
import { joinPath, relativePath } from "./paths.js";
import { walkFiles } from "./walk.js";

/**
 * The indexer: turns plain files into index rows (SPEC §5.4). All SQL lives
 * here in core; the storage adapter only executes. Nothing in the index is
 * anything but a derivation — `rebuildIndex` reproduces it wholesale.
 */

const INDEX_IGNORE_DIRS = [".eden", ".git", "exports", "node_modules"];

/** Minimal timer capability — every supported runtime has setTimeout. */
declare const setTimeout: (callback: () => void, ms: number) => unknown;

/** Apply the schema (idempotent) and stamp the schema version. */
export function ensureIndexSchema(index: IndexStorageAdapter): void {
  index.exec(INDEX_SCHEMA_SQL);
  index.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [
    "schema_version",
    INDEX_SCHEMA_VERSION,
  ]);
}

export function readSchemaVersion(index: IndexStorageAdapter): string | null {
  const rows = index.query<{ value: string }>(
    "SELECT value FROM meta WHERE key = ?",
    ["schema_version"],
  );
  return rows[0]?.value ?? null;
}

/** Local date as YYYY-MM-DD (daily stats, §7.8). */
function todayString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function containerOf(relPath: string): string {
  const segments = relPath.split("/");
  // Container = the top-level folder ("world", "chapters"); files loose at
  // the eden root belong to the root itself.
  return segments.length > 1 ? segments[0] : ".";
}

/** Refresh one container's per-day word total after a change (§7.8). */
export function updateDailyWords(
  index: IndexStorageAdapter,
  container: string,
): void {
  const rows = index.query<{ total: number }>(
    "SELECT COALESCE(SUM(word_count), 0) AS total FROM files WHERE container = ?",
    [container],
  );
  index.run(
    "INSERT OR REPLACE INTO daily_words (day, container, words) VALUES (?, ?, ?)",
    [todayString(), container, rows[0]?.total ?? 0],
  );
}

/** (Re)index one markdown file. `relPath` is eden-relative. */
export async function indexFile(
  fs: FileSystemAdapter,
  index: IndexStorageAdapter,
  edenRoot: string,
  relPath: string,
  options?: { skipDaily?: boolean },
): Promise<void> {
  const absPath = joinPath(edenRoot, relPath);
  const [text, stat] = await Promise.all([
    fs.readFile(absPath),
    fs.stat(absPath),
  ]);
  const derived = deriveFile(relPath, text);
  const container = containerOf(relPath);

  index.transaction(() => {
    index.run("DELETE FROM files WHERE path = ?", [relPath]);
    index.run("DELETE FROM links WHERE source_path = ?", [relPath]);
    index.run("DELETE FROM mentions WHERE source_path = ?", [relPath]);
    index.run("DELETE FROM files_fts WHERE path = ?", [relPath]);

    index.run(
      `INSERT INTO files (path, container, kind, stable_id, title, status,
        story_date, word_count, frontmatter, mtime_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        relPath,
        container,
        kindFromPath(relPath),
        derived.stableId,
        derived.title,
        derived.status,
        derived.storyDate,
        derived.wordCount,
        JSON.stringify(derived.frontmatter),
        stat?.modifiedAtMs ?? 0,
      ],
    );
    for (const link of derived.links) {
      index.run(
        "INSERT INTO links (source_path, target_raw, kind, line) VALUES (?, ?, ?, ?)",
        [relPath, link.targetRaw, link.kind, link.line],
      );
    }
    for (const mention of derived.mentions) {
      index.run(
        "INSERT INTO mentions (source_path, entity_key, count) VALUES (?, ?, ?)",
        [relPath, mention.entityKey, mention.count],
      );
    }
    index.run("INSERT INTO files_fts (path, title, body) VALUES (?, ?, ?)", [
      relPath,
      derived.title,
      text,
    ]);
  });
  if (!options?.skipDaily) {
    updateDailyWords(index, container);
  }
}

/** Drop one file from the index (after deletion or rename-away). */
export function removeIndexedFile(
  index: IndexStorageAdapter,
  relPath: string,
): void {
  const container = containerOf(relPath);
  index.transaction(() => {
    index.run("DELETE FROM files WHERE path = ?", [relPath]);
    index.run("DELETE FROM links WHERE source_path = ?", [relPath]);
    index.run("DELETE FROM mentions WHERE source_path = ?", [relPath]);
    index.run("DELETE FROM files_fts WHERE path = ?", [relPath]);
  });
  updateDailyWords(index, container);
}

export interface RebuildReport {
  files: number;
  durationMs: number;
}

/**
 * Rebuild the entire index from the files on disk. Wipes and re-derives —
 * this is why deleting `index.db` is a non-event (SPEC §12 M1 done-when).
 */
export async function rebuildIndex(
  fs: FileSystemAdapter,
  index: IndexStorageAdapter,
  edenRoot: string,
  onProgress?: (done: number, total: number) => void,
): Promise<RebuildReport> {
  const startedAt = Date.now();
  ensureIndexSchema(index);

  index.transaction(() => {
    index.run("DELETE FROM files");
    index.run("DELETE FROM links");
    index.run("DELETE FROM mentions");
    index.run("DELETE FROM files_fts");
    index.run("DELETE FROM daily_words");
  });

  const targets = await walkFiles(fs, edenRoot, {
    ignoreDirs: INDEX_IGNORE_DIRS,
    extensions: [".md"],
  });
  // The first-run welcome note is orientation, not writing — its words must
  // never count toward goals, so it stays out of the index on every path
  // (rebuild here, incremental in the shell's isContentPath).
  const indexed = targets.filter(
    (absPath) => relativePath(edenRoot, absPath) !== EDEN_WELCOME_FILE,
  );

  let done = 0;
  const containers = new Set<string>();
  for (const absPath of indexed) {
    const relPath = relativePath(edenRoot, absPath);
    try {
      await indexFile(fs, index, edenRoot, relPath, { skipDaily: true });
      containers.add(containerOf(relPath));
    } catch {
      // A file that vanishes or can't be read mid-rebuild is skipped; the
      // watcher will index it if it comes back. Rebuilds never fail wholesale.
    }
    done += 1;
    if (done % 25 === 0) {
      onProgress?.(done, indexed.length);
      // Yield so the main process stays responsive on 10k-file edens (§11).
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 0);
      });
    }
  }
  onProgress?.(done, indexed.length);

  // One daily-total refresh per container, not per file (§7.8, §11 budgets).
  for (const container of containers) {
    updateDailyWords(index, container);
  }

  return { files: done, durationMs: Date.now() - startedAt };
}
