import type {
  CreateProjectInput,
  DirEntry,
  EdenInfo,
  EdenSettings,
  IndexedEntitySummary,
  IndexedFileSummary,
  ProjectManifest,
  SearchFilter,
  SearchHitRow,
  SnapshotInfo,
  WatchEvent,
  WatchHandle,
  WorldManifest,
} from "@edenwright/core";
import {
  EdenwrightError,
  conflictedCopyName,
  createEden,
  createProject,
  createWorld,
  ensureIndexSchema,
  getBacklinks,
  getEntityAppearances,
  getIndexedFileInfo,
  getOutgoingLinks,
  indexFile,
  isAbsolutePath,
  isEden,
  joinPath,
  listEntitiesForProject,
  listIndexedEntities,
  listIndexedFiles,
  listProjects,
  listWorlds,
  loadEdenSettings,
  normalizePath,
  rebuildIndex,
  relativePath,
  removeIndexedFile,
  resolveLinkTarget,
  saveEdenSettings,
  searchIndex,
  serializeManifest,
  walkFiles,
} from "@edenwright/core";
import { validatePluginManifest } from "@edenwright/plugin-api";

import type { ChokidarWatcherAdapter } from "./adapters/chokidar-watcher.js";
import type { NodeFileSystemAdapter } from "./adapters/node-file-system.js";
import { SqliteIndexStorageAdapter } from "./adapters/sqlite-index.js";
import type { RecentEdensStore } from "./recent-edens.js";
import { SnapshotManager } from "./snapshot-manager.js";

export interface OpenEden {
  info: EdenInfo;
  settings: EdenSettings;
}

export interface TreeNode {
  name: string;
  /** Eden-relative, normalized. */
  path: string;
  kind: "file" | "directory";
  children?: TreeNode[];
}

export interface WriteResult {
  ok: boolean;
  /** Set when the write became a conflict copy (SPEC §5.4). */
  conflictedPath: string | null;
  mtimeMs: number;
}

export type EdenServiceEvent =
  | { type: "eden-opened" }
  | { type: "eden-closed" }
  | { type: "settings-changed" }
  | { type: "tree-changed" }
  | { type: "file-changed"; path: string; mtimeMs: number }
  | { type: "index-progress"; done: number; total: number }
  | { type: "index-rebuilt"; files: number }
  | {
      type: "plugin-file-event";
      kind: "create" | "change" | "delete";
      path: string;
    }
  | { type: "notice"; message: string };

const WATCH_IGNORE_DIRS = [".eden", ".git", "exports", "node_modules"];
const CONTENT_ROOTS = ["Projects/", "Worlds/"];
const INDEX_FILE = "index.db";

function isMarkdown(relPath: string): boolean {
  return relPath.toLowerCase().endsWith(".md");
}

function isContentPath(relPath: string): boolean {
  return CONTENT_ROOTS.some((root) => relPath.startsWith(root));
}

/** Our atomic-write temp siblings (`.name.<hex>.tmp`) are not events. */
function isOwnTempFile(relPath: string): boolean {
  const name = relPath.slice(relPath.lastIndexOf("/") + 1);
  return name.startsWith(".") && name.endsWith(".tmp");
}

/**
 * The eden service: owns the open eden, its watcher, its index, and its
 * snapshot schedule. Everything renderer-side flows through here over IPC.
 */
export class EdenService {
  private current: OpenEden | null = null;
  private watcher: WatchHandle | null = null;
  private index: SqliteIndexStorageAdapter | null = null;
  private snapshots: SnapshotManager | null = null;
  private emit: (event: EdenServiceEvent) => void = () => undefined;

  /** relPath → mtime of writes we made ourselves (echo suppression). */
  private readonly ownWrites = new Map<string, number>();
  private readonly changedSinceSnapshot = new Set<string>();
  private snapshotTimer: NodeJS.Timeout | null = null;
  private rebuilding = false;
  private bufferedEvents: WatchEvent[] = [];
  private treeDebounce: NodeJS.Timeout | null = null;

  constructor(
    private readonly fs: NodeFileSystemAdapter,
    private readonly watcherAdapter: ChokidarWatcherAdapter,
    private readonly recents: RecentEdensStore,
  ) {}

  setEventSink(emit: (event: EdenServiceEvent) => void): void {
    this.emit = emit;
  }

  state(): OpenEden | null {
    return this.current;
  }

  async create(parentDir: string, name: string): Promise<OpenEden> {
    const info = await createEden(this.fs, parentDir, name);
    return this.open(info.path);
  }

  async open(path: string): Promise<OpenEden> {
    const root = normalizePath(path);
    if (!(await isEden(this.fs, root))) {
      throw new EdenwrightError(
        "IO",
        "That folder isn't an eden yet — no .eden folder inside.",
      );
    }

    await this.close();

    const settings = await loadEdenSettings(this.fs, root);
    const index = new SqliteIndexStorageAdapter();
    const indexPath = joinPath(root, ".eden", INDEX_FILE);
    try {
      await index.open(indexPath);
      ensureIndexSchema(index);
    } catch {
      // Corrupt database: delete and recreate — a non-event by design (§5.4).
      await index.close().catch(() => undefined);
      for (const suffix of ["", "-wal", "-shm"]) {
        await this.fs.remove(indexPath + suffix);
      }
      await index.open(indexPath);
      ensureIndexSchema(index);
    }

    this.current = {
      info: { name: root.slice(root.lastIndexOf("/") + 1), path: root },
      settings,
    };
    this.index = index;
    this.snapshots = new SnapshotManager(this.fs, root, settings.snapshots);

    await this.recents.touch(this.current.info);
    this.emit({ type: "eden-opened" });
    this.startWatcher(root);
    this.startSnapshotTimer(settings.snapshots.intervalMinutes);
    void this.rebuild();

    return this.current;
  }

  async close(): Promise<void> {
    const hadEden = this.current !== null;
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.current) {
      // Session end: snapshot whatever changed (SPEC §5.4).
      await this.snapshotNow().catch(() => undefined);
    }
    await this.watcher?.close();
    this.watcher = null;
    await this.index?.close();
    this.index = null;
    this.snapshots = null;
    this.current = null;
    this.ownWrites.clear();
    this.changedSinceSnapshot.clear();
    this.bufferedEvents = [];
    // Only a real close is an event — open() calls close() before opening,
    // and an unborn eden should not fire lifecycle signals.
    if (hadEden) {
      this.emit({ type: "eden-closed" });
    }
  }

  /** Rebuild the whole index from files; watcher events queue meanwhile. */
  private async rebuild(): Promise<void> {
    if (!this.current || !this.index) return;
    this.rebuilding = true;
    try {
      const report = await rebuildIndex(
        this.fs,
        this.index,
        this.current.info.path,
        (done, total) => {
          this.emit({ type: "index-progress", done, total });
        },
      );
      this.emit({ type: "index-rebuilt", files: report.files });
      this.emit({ type: "tree-changed" });
    } finally {
      this.rebuilding = false;
    }
    const queued = this.bufferedEvents;
    this.bufferedEvents = [];
    for (const event of queued) {
      await this.handleWatchEvent(event);
    }
  }

  private startWatcher(root: string): void {
    void this.watcherAdapter
      .watch(root, (event) => void this.handleWatchEvent(event), {
        ignoreDirs: WATCH_IGNORE_DIRS,
      })
      .then((handle) => {
        this.watcher = handle;
      })
      .catch(() => {
        this.emit({
          type: "notice",
          message:
            "File watching failed to start — external changes won't appear live.",
        });
      });
  }

  private async handleWatchEvent(event: WatchEvent): Promise<void> {
    if (!this.current) return;
    if (this.rebuilding) {
      this.bufferedEvents.push(event);
      return;
    }

    const root = this.current.info.path;
    const rel = relativePath(root, event.path);
    if (rel.startsWith("..") || rel === "." || isOwnTempFile(rel)) return;

    if (event.entryKind === "directory") {
      this.scheduleTreeChanged();
      return;
    }

    if (event.kind === "unlink") {
      if (this.index && isMarkdown(rel) && isContentPath(rel)) {
        removeIndexedFile(this.index, rel);
      }
      this.changedSinceSnapshot.add(rel);
      this.scheduleTreeChanged();
      this.emit({ type: "file-changed", path: rel, mtimeMs: 0 });
      this.emit({ type: "plugin-file-event", kind: "delete", path: rel });
      return;
    }

    // add / change
    const stat = await this.fs.stat(event.path);
    if (!stat || stat.kind !== "file") return;

    const ownMtime = this.ownWrites.get(rel);
    if (ownMtime !== undefined && ownMtime === stat.modifiedAtMs) {
      this.ownWrites.delete(rel);
      return; // Echo of our own atomic write.
    }

    this.changedSinceSnapshot.add(rel);
    if (this.index && isMarkdown(rel) && isContentPath(rel)) {
      try {
        await indexFile(this.fs, this.index, root, rel);
      } catch {
        // A file that vanishes mid-event is skipped; the next event catches up.
        return;
      }
    }
    this.scheduleTreeChanged();
    this.emit({ type: "file-changed", path: rel, mtimeMs: stat.modifiedAtMs });
    this.emit({
      type: "plugin-file-event",
      kind: event.kind === "add" ? "create" : "change",
      path: rel,
    });
  }

  private scheduleTreeChanged(): void {
    if (this.treeDebounce) clearTimeout(this.treeDebounce);
    this.treeDebounce = setTimeout(() => {
      this.treeDebounce = null;
      this.emit({ type: "tree-changed" });
    }, 150);
  }

  /** File tree of Projects/ + Worlds/, directories first, then files. */
  async tree(): Promise<TreeNode[]> {
    if (!this.current) return [];
    const root = this.current.info.path;

    const build = async (relDir: string, name: string): Promise<TreeNode> => {
      const node: TreeNode = {
        name,
        path: relDir,
        kind: "directory",
        children: [],
      };
      let entries;
      try {
        entries = await this.fs.list(joinPath(root, relDir));
      } catch {
        return node;
      }
      const visible = entries.filter(
        (entry) =>
          !entry.name.startsWith(".") &&
          !(
            entry.kind === "directory" && WATCH_IGNORE_DIRS.includes(entry.name)
          ),
      );
      visible.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const entry of visible) {
        const childRel = `${relDir}/${entry.name}`;
        if (entry.kind === "directory") {
          node.children!.push(await build(childRel, entry.name));
        } else if (entry.kind === "file") {
          node.children!.push({
            name: entry.name,
            path: childRel,
            kind: "file",
          });
        }
      }
      return node;
    };

    const roots: TreeNode[] = [];
    for (const top of ["Projects", "Worlds"]) {
      if (await this.fs.exists(joinPath(root, top))) {
        roots.push(await build(top, top));
      }
    }
    return roots;
  }

  async readFile(
    relPath: string,
  ): Promise<{ content: string; mtimeMs: number }> {
    this.requireCurrent();
    const absPath = joinPath(this.current!.info.path, relPath);
    const [content, stat] = await Promise.all([
      this.fs.readFile(absPath),
      this.fs.stat(absPath),
    ]);
    return { content, mtimeMs: stat?.modifiedAtMs ?? 0 };
  }

  /**
   * Write with conflict safety (SPEC §5.4): if the file on disk no longer
   * matches the mtime the caller based its edits on, the new content goes to
   * a conflicted copy beside it — never over the disk version.
   */
  async writeFile(
    relPath: string,
    content: string,
    baseMtimeMs: number | null,
  ): Promise<WriteResult> {
    this.requireCurrent();
    const root = this.current!.info.path;
    const absPath = joinPath(root, relPath);
    const stat = await this.fs.stat(absPath);

    if (stat && baseMtimeMs !== null && stat.modifiedAtMs !== baseMtimeMs) {
      const conflictRel = conflictedCopyName(relPath, new Date());
      await this.fs.writeFile(joinPath(root, conflictRel), content);
      const copyStat = await this.fs.stat(joinPath(root, conflictRel));
      const copyMtime = copyStat?.modifiedAtMs ?? Date.now();
      this.ownWrites.set(conflictRel, copyMtime);
      this.changedSinceSnapshot.add(conflictRel);
      if (this.index && isMarkdown(conflictRel) && isContentPath(conflictRel)) {
        await indexFile(this.fs, this.index, root, conflictRel).catch(
          () => undefined,
        );
      }
      this.scheduleTreeChanged();
      return { ok: true, conflictedPath: conflictRel, mtimeMs: copyMtime };
    }

    await this.fs.writeFile(absPath, content);
    const newStat = await this.fs.stat(absPath);
    const mtimeMs = newStat?.modifiedAtMs ?? Date.now();
    this.ownWrites.set(relPath, mtimeMs);
    this.changedSinceSnapshot.add(relPath);
    if (this.index && isMarkdown(relPath) && isContentPath(relPath)) {
      await indexFile(this.fs, this.index, root, relPath).catch(
        () => undefined,
      );
    }
    this.scheduleTreeChanged();
    return { ok: true, conflictedPath: null, mtimeMs };
  }

  async createFile(relPath: string): Promise<void> {
    this.requireCurrent();
    if (await this.fs.exists(joinPath(this.current!.info.path, relPath))) {
      throw new EdenwrightError("IO", `"${relPath}" already exists.`);
    }
    await this.writeFile(relPath, "", null);
  }

  async createFolder(relPath: string): Promise<void> {
    this.requireCurrent();
    await this.fs.mkdir(joinPath(this.current!.info.path, relPath));
    this.scheduleTreeChanged();
  }

  async rename(fromRel: string, toRel: string): Promise<void> {
    this.requireCurrent();
    const root = this.current!.info.path;
    if (await this.fs.exists(joinPath(root, toRel))) {
      throw new EdenwrightError("IO", `"${toRel}" already exists.`);
    }
    await this.fs.move(joinPath(root, fromRel), joinPath(root, toRel));
    // Suppress the watcher's echo of our own rename.
    const toStat = await this.fs.stat(joinPath(root, toRel));
    if (toStat) this.ownWrites.set(toRel, toStat.modifiedAtMs);
    if (this.index && isMarkdown(fromRel) && isContentPath(fromRel)) {
      removeIndexedFile(this.index, fromRel);
    }
    if (this.index && isMarkdown(toRel) && isContentPath(toRel)) {
      await indexFile(this.fs, this.index, root, toRel).catch(() => undefined);
    }
    this.changedSinceSnapshot.add(fromRel).add(toRel);
    this.scheduleTreeChanged();
  }

  async delete(relPath: string): Promise<void> {
    this.requireCurrent();
    await this.fs.remove(joinPath(this.current!.info.path, relPath));
    if (this.index && isMarkdown(relPath) && isContentPath(relPath)) {
      removeIndexedFile(this.index, relPath);
    }
    this.changedSinceSnapshot.add(relPath);
    this.scheduleTreeChanged();
  }

  /** Snapshot everything changed since the last one; prune oldest-first. */
  async snapshotNow(): Promise<string | null> {
    if (!this.snapshots) return null;
    const name = await this.snapshots.createSnapshot([
      ...this.changedSinceSnapshot,
    ]);
    if (name) {
      this.changedSinceSnapshot.clear();
      await this.snapshots.prune();
    }
    return name;
  }

  private startSnapshotTimer(intervalMinutes: number): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.snapshotTimer = setInterval(
      () => {
        void this.snapshotNow().catch(() => undefined);
      },
      Math.max(1, intervalMinutes) * 60_000,
    );
    this.snapshotTimer.unref();
  }

  /** Full-text search over the index (§7.3). */
  search(query: string, filter?: SearchFilter): SearchHitRow[] {
    this.requireCurrent();
    return searchIndex(this.index!, query, filter);
  }

  /** Corkboard cards (§7.7): title, synopsis, status per file, by container. */
  corkboard(containerPrefix?: string): {
    path: string;
    title: string;
    status: string | null;
    synopsis: string;
    container: string;
  }[] {
    this.requireCurrent();
    const rows = this.index!.query<{
      path: string;
      title: string;
      status: string | null;
      container: string;
      frontmatter: string;
    }>(
      containerPrefix
        ? "SELECT path, title, status, container, frontmatter FROM files WHERE container = ? ORDER BY path"
        : "SELECT path, title, status, container, frontmatter FROM files ORDER BY path",
      containerPrefix ? [containerPrefix] : [],
    );
    return rows.map((row) => {
      let synopsis = "";
      try {
        const frontmatter = JSON.parse(row.frontmatter) as Record<
          string,
          unknown
        >;
        if (typeof frontmatter.synopsis === "string") {
          synopsis = frontmatter.synopsis;
        }
      } catch {
        synopsis = "";
      }
      return {
        path: row.path,
        title: row.title,
        status: row.status,
        synopsis,
        container: row.container,
      };
    });
  }

  /** History (§7.9): snapshots holding a version of the file, newest first. */
  async historyVersions(relPath: string): Promise<SnapshotInfo[]> {
    this.requireCurrent();
    if (!this.snapshots) return [];
    return this.snapshots.listVersions(relPath);
  }

  /** History (§7.9): one version's content, or null. */
  async historyReadVersion(
    snapshotName: string,
    relPath: string,
  ): Promise<string | null> {
    this.requireCurrent();
    if (!this.snapshots) return null;
    return this.snapshots.readVersion(snapshotName, relPath);
  }

  /**
   * History (§7.9): one-click restore — snapshot the present first, then
   * write the old version through the conflict-safe path. History is never
   * rewritten; a restore is just a new write.
   */
  async historyRestore(
    snapshotName: string,
    relPath: string,
  ): Promise<WriteResult> {
    this.requireCurrent();
    const content = await this.historyReadVersion(snapshotName, relPath);
    if (content === null) {
      throw new EdenwrightError(
        "NOT_FOUND",
        `"${relPath}" isn't in snapshot ${snapshotName}.`,
      );
    }
    // The present goes into a fresh snapshot before we touch it (§11).
    await this.snapshotNow();
    const stat = await this.fs.stat(joinPath(this.current!.info.path, relPath));
    return this.writeFile(relPath, content, stat?.modifiedAtMs ?? null);
  }

  /** Goals & streaks data (§7.8): totals plus a per-day series. */
  stats(
    container: string,
    days = 35,
  ): {
    total: number;
    today: number;
    series: { day: string; words: number }[];
  } {
    this.requireCurrent();
    const totalRow = this.index!.query<{ total: number }>(
      "SELECT COALESCE(SUM(word_count), 0) AS total FROM files WHERE container = ?",
      [container],
    );
    const rows = this.index!.query<{ day: string; words: number }>(
      "SELECT day, words FROM daily_words WHERE container = ? ORDER BY day DESC LIMIT ?",
      [container, days],
    );
    const byDay = new Map(rows.map((row) => [row.day, row.words]));

    const series: { day: string; words: number }[] = [];
    const cursor = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(cursor.getTime() - i * 86_400_000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      series.push({ day: key, words: byDay.get(key) ?? 0 });
    }

    return {
      total: totalRow[0]?.total ?? 0,
      today: series[series.length - 1]?.words ?? 0,
      series,
    };
  }

  /** Dated files with their mention keys, for the timeline (§7.6). */
  timeline(): {
    path: string;
    title: string;
    storyDate: string;
    container: string;
    mentions: string[];
  }[] {
    this.requireCurrent();
    const rows = this.index!.query<{
      path: string;
      title: string;
      story_date: string;
      container: string;
    }>(
      "SELECT path, title, story_date, container FROM files WHERE story_date IS NOT NULL AND story_date != '' ORDER BY story_date, path",
    );
    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      storyDate: row.story_date,
      container: row.container,
      mentions: this.index!.query<{ entity_key: string }>(
        "SELECT entity_key FROM mentions WHERE source_path = ?",
        [row.path],
      ).map((mention) => mention.entity_key),
    }));
  }

  /** Every indexed file — the quick switcher's universe. */
  listFiles(): IndexedFileSummary[] {
    this.requireCurrent();
    return listIndexedFiles(this.index!);
  }

  /** Codex entities — the `@` completion's universe. */
  listEntities(): IndexedEntitySummary[] {
    this.requireCurrent();
    return listIndexedEntities(this.index!);
  }

  /** Entities visible from one project: its codex plus linked worlds' (§7.5). */
  async entitiesForProject(
    projectName: string,
  ): Promise<IndexedEntitySummary[]> {
    this.requireCurrent();
    const projects = await this.listProjects();
    const project = projects.find((item) => item.name === projectName);
    return listEntitiesForProject(
      this.index!,
      projectName,
      project?.linkedWorlds ?? [],
    );
  }

  /** Update a project's manifest (linked worlds, goals, order). */
  async updateProject(
    name: string,
    patch: {
      linkedWorlds?: string[];
      goals?: ProjectManifest["goals"];
      order?: string[];
    },
  ): Promise<ProjectManifest> {
    this.requireCurrent();
    const projects = await this.listProjects();
    const project = projects.find((item) => item.name === name);
    if (!project) {
      throw new EdenwrightError("NOT_FOUND", `No project called "${name}".`);
    }
    const next: ProjectManifest = {
      ...project,
      linkedWorlds: patch.linkedWorlds ?? project.linkedWorlds,
      goals: patch.goals ?? project.goals,
      order: patch.order ?? project.order,
    };
    const root = this.current!.info.path;
    await this.fs.writeFile(
      joinPath(root, "Projects", name, "project.json"),
      serializeManifest(next),
    );
    this.scheduleTreeChanged();
    return next;
  }

  /** Promote an entity from a project's codex to a world's codex (§7.5). */
  async moveEntityToWorld(
    entityRelPath: string,
    worldName: string,
  ): Promise<string> {
    this.requireCurrent();
    if (!entityRelPath.startsWith("Projects/")) {
      throw new EdenwrightError(
        "IO",
        "Only project-local entities can be promoted to a world.",
      );
    }
    const worlds = await this.listWorlds();
    if (!worlds.some((world) => world.name === worldName)) {
      throw new EdenwrightError("NOT_FOUND", `No world called "${worldName}".`);
    }
    const root = this.current!.info.path;
    const fileName = entityRelPath.slice(entityRelPath.lastIndexOf("/") + 1);
    const target = `Worlds/${worldName}/codex/${fileName}`;
    if (await this.fs.exists(joinPath(root, target))) {
      throw new EdenwrightError(
        "IO",
        `"${fileName}" already exists in ${worldName}'s codex.`,
      );
    }
    await this.fs.move(joinPath(root, entityRelPath), joinPath(root, target));
    const stat = await this.fs.stat(joinPath(root, target));
    if (stat) this.ownWrites.set(target, stat.modifiedAtMs);
    removeIndexedFile(this.index!, entityRelPath);
    await indexFile(this.fs, this.index!, root, target).catch(() => undefined);
    this.changedSinceSnapshot.add(entityRelPath).add(target);
    this.scheduleTreeChanged();
    return target;
  }

  /** Resolve a `[[raw target]]` to an eden-relative path, or null. */
  resolveLink(raw: string): string | null {
    this.requireCurrent();
    const rows = this.index!.query<{
      path: string;
      title: string;
      stable_id: string | null;
    }>("SELECT path, title, stable_id FROM files");
    return resolveLinkTarget(
      raw,
      rows.map((row) => ({
        path: row.path,
        title: row.title,
        stableId: row.stable_id,
      })),
    );
  }

  /** Backlinks to a raw target (the plugin API's IndexQueryApi, §9.2). */
  backlinks(
    targetRaw: string,
  ): { sourcePath: string; kind: string; line: number }[] {
    this.requireCurrent();
    return getBacklinks(this.index!, targetRaw);
  }

  /** Outgoing links from a file. */
  outgoingLinks(
    sourcePath: string,
  ): { targetRaw: string; kind: string; line: number }[] {
    this.requireCurrent();
    return getOutgoingLinks(this.index!, sourcePath);
  }

  /** Every file mentioning an entity key, with counts (§7.4). */
  entityAppearances(entityKey: string): { path: string; count: number }[] {
    this.requireCurrent();
    return getEntityAppearances(this.index!, entityKey);
  }

  /** One indexed file's derivation, or null. */
  fileInfo(path: string) {
    this.requireCurrent();
    return getIndexedFileInfo(this.index!, path);
  }

  /** Create a project folder with its manifest and subfolders (§5.5). */
  async createProject(input: CreateProjectInput): Promise<ProjectManifest> {
    this.requireCurrent();
    const manifest = await createProject(
      this.fs,
      this.current!.info.path,
      input,
    );
    this.scheduleTreeChanged();
    return manifest;
  }

  /** Every valid project manifest under Projects/, sorted. */
  listProjects(): Promise<ProjectManifest[]> {
    this.requireCurrent();
    return listProjects(this.fs, this.current!.info.path);
  }

  /** Create a codex-first world under Worlds/ (SPEC §8.5). */
  async createWorld(name: string): Promise<WorldManifest> {
    this.requireCurrent();
    const manifest = await createWorld(this.fs, this.current!.info.path, name);
    this.scheduleTreeChanged();
    return manifest;
  }

  /** Every valid world manifest under Worlds/, sorted. */
  listWorlds(): Promise<WorldManifest[]> {
    this.requireCurrent();
    return listWorlds(this.fs, this.current!.info.path);
  }

  /** Persist eden settings and apply what changed live (§9.3 snapshot timer). */
  async saveSettings(settings: EdenSettings): Promise<void> {
    this.requireCurrent();
    await saveEdenSettings(this.fs, this.current!.info.path, settings);
    this.current!.settings = settings;
    this.startSnapshotTimer(settings.snapshots.intervalMinutes);
    this.emit({ type: "settings-changed" });
  }

  /** Public wrapper for IPC handlers needing the same guard. */
  resolveInsideEdenPublic(relPath: string): string {
    return this.resolveInsideEden(relPath);
  }

  /** Resolve an eden-relative path for plugin file access — no escapes. */
  private resolveInsideEden(relPath: string): string {
    this.requireCurrent();
    const root = this.current!.info.path;
    const normalized = normalizePath(relPath);
    if (
      isAbsolutePath(normalized) ||
      normalized === ".." ||
      normalized.startsWith("../")
    ) {
      throw new EdenwrightError("IO", `Paths stay inside the eden: ${relPath}`);
    }
    return joinPath(root, normalized);
  }

  pluginfsRead(relPath: string): Promise<string> {
    return this.fs.readFile(this.resolveInsideEden(relPath));
  }

  pluginfsReadBinary(relPath: string): Promise<Uint8Array> {
    return this.fs.readFileBinary(this.resolveInsideEden(relPath));
  }

  async pluginfsWrite(relPath: string, content: string): Promise<void> {
    await this.fs.writeFile(this.resolveInsideEden(relPath), content);
    this.scheduleTreeChanged();
  }

  async pluginfsWriteBinary(relPath: string, data: Uint8Array): Promise<void> {
    await this.fs.writeFileBinary(this.resolveInsideEden(relPath), data);
    this.scheduleTreeChanged();
  }

  pluginfsList(relPath: string): Promise<DirEntry[]> {
    return this.fs.list(this.resolveInsideEden(relPath));
  }

  async pluginfsMkdir(relPath: string): Promise<void> {
    await this.fs.mkdir(this.resolveInsideEden(relPath));
    this.scheduleTreeChanged();
  }

  async pluginfsRemove(relPath: string): Promise<void> {
    await this.fs.remove(this.resolveInsideEden(relPath));
    this.scheduleTreeChanged();
  }

  async pluginfsRename(from: string, to: string): Promise<void> {
    await this.fs.move(
      this.resolveInsideEden(from),
      this.resolveInsideEden(to),
    );
    this.scheduleTreeChanged();
  }

  pluginfsExists(relPath: string): Promise<boolean> {
    return this.fs.exists(this.resolveInsideEden(relPath));
  }

  pluginfsStat(relPath: string) {
    return this.fs.stat(this.resolveInsideEden(relPath));
  }

  /** Directories under `.eden/plugins/` with their raw manifest texts. */
  async discoverPlugins(): Promise<
    { dir: string; manifestText: string | null }[]
  > {
    this.requireCurrent();
    const pluginsDir = joinPath(this.current!.info.path, ".eden", "plugins");
    let entries: DirEntry[];
    try {
      entries = await this.fs.list(pluginsDir);
    } catch {
      return [];
    }
    const found: { dir: string; manifestText: string | null }[] = [];
    for (const entry of entries) {
      if (entry.kind !== "directory") continue;
      let manifestText: string | null = null;
      try {
        manifestText = await this.fs.readFile(
          joinPath(pluginsDir, entry.name, "manifest.json"),
        );
      } catch {
        manifestText = null;
      }
      found.push({ dir: entry.name, manifestText });
    }
    return found;
  }

  /**
   * Install a plugin from a folder anywhere on disk: validate its manifest,
   * then copy it into `.eden/plugins/<id>/` (SPEC §12 M3 done-when).
   */
  async installPluginFromFolder(sourceDir: string): Promise<string> {
    this.requireCurrent();
    const source = normalizePath(sourceDir);
    let manifestText: string;
    try {
      manifestText = await this.fs.readFile(joinPath(source, "manifest.json"));
    } catch {
      throw new EdenwrightError(
        "NOT_FOUND",
        `No manifest.json in ${source} — a plugin is a folder with a manifest and a main.js.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestText);
    } catch {
      throw new EdenwrightError(
        "MANIFEST_INVALID",
        "manifest.json isn't valid JSON.",
      );
    }
    const validation = validatePluginManifest(parsed);
    if (!validation.ok) {
      throw new EdenwrightError("MANIFEST_INVALID", validation.error);
    }

    const target = joinPath(
      this.current!.info.path,
      ".eden",
      "plugins",
      validation.manifest.id,
    );
    if (await this.fs.exists(target)) {
      throw new EdenwrightError(
        "IO",
        `Plugin "${validation.manifest.id}" is already installed.`,
      );
    }

    const files = await walkFiles(this.fs, source, {
      ignoreDirs: [".git", "node_modules"],
    });
    for (const absPath of files) {
      const rel = relativePath(source, absPath);
      await this.fs.writeFileBinary(
        joinPath(target, rel),
        await this.fs.readFileBinary(absPath),
      );
    }
    this.scheduleTreeChanged();
    return validation.manifest.id;
  }

  /** Test hook (EDENWRIGHT_TEST=1): index size for assertions. */
  async indexStats(): Promise<{ files: number }> {
    if (!this.index) return { files: 0 };
    const rows = this.index.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM files",
    );
    return { files: rows[0]?.count ?? 0 };
  }

  /** Test hook (EDENWRIGHT_TEST=1): wait for the open-time rebuild. */
  async whenRebuilt(): Promise<void> {
    while (this.rebuilding) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  private requireCurrent(): void {
    if (!this.current) {
      throw new EdenwrightError("IO", "No eden is open.");
    }
  }
}
