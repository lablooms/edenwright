/**
 * The bridge the renderer can touch. Pure types, shared by the preload
 * implementation (tsconfig.node) and the renderer's global declaration
 * (tsconfig.web) — no implementation lives here.
 */

import type { EdenSettings } from "@edenwright/core";

/** Host OS — exactly the three targets Edenwright ships for. */
export type EdenwrightPlatform = "darwin" | "win32" | "linux";

export interface WindowControls {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** DevTools for plugin developers and the curious (Help menu). */
  toggleDevTools(): Promise<void>;
  /** Subscribe to maximize/restore changes; returns an unsubscribe. */
  onMaximizedChanged(callback: (isMaximized: boolean) => void): () => void;
}

export interface RecentEden {
  name: string;
  path: string;
  /** Preset id when known — entries from before R2 may lack every detail. */
  preset?: string;
  medium?: string;
  /** ISO time of the last open; absent means "unknown", not "broken". */
  lastOpenedAt?: string;
}

export interface EdenGoalsInfo {
  targetWords?: number;
  dailyWords?: number;
}

/** eden.json — one eden = one project = one world, so this is all three. */
export interface EdenManifestInfo {
  id: string;
  name: string;
  /** Preset id, e.g. "novel", "manga". */
  preset: string;
  /** The preset's medium tag (denormalized for exporter/plugin joins). */
  medium: string;
  createdAt: string;
  description: string;
  goals: EdenGoalsInfo;
  /** Ordered structure-node ids at the root of the story tree. */
  order: string[];
}

export interface ScaffoldEntryInput {
  /** Eden-relative path (folder when `contents` is omitted). */
  path: string;
  contents?: string;
}

/** What creating an eden needs: the preset's identity plus its scaffold. */
export interface CreateEdenInput {
  preset: string;
  medium: string;
  scaffold: ScaffoldEntryInput[];
  description?: string;
}

export interface OpenEdenInfo {
  info: { name: string; path: string };
  settings: EdenSettings;
  manifest: EdenManifestInfo;
}

export interface EdenStateInfo {
  current: OpenEdenInfo | null;
  recents: RecentEden[];
}

export interface TreeNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: TreeNode[];
}

export interface FileContents {
  content: string;
  mtimeMs: number;
}

export interface WriteResult {
  ok: boolean;
  conflictedPath: string | null;
  mtimeMs: number;
}

export type EdenEventPayload =
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

export interface EdenApi {
  state(): Promise<EdenStateInfo>;
  create(
    parentDir: string,
    name: string,
    input: CreateEdenInput,
  ): Promise<EdenStateInfo>;
  open(path: string): Promise<EdenStateInfo>;
  close(): Promise<void>;
  /** Forget a recents entry (files are never touched); resolves the list. */
  removeRecent(path: string): Promise<RecentEden[]>;
  /** Native folder picker for the launcher flows; null when cancelled. */
  pickDirectory(title?: string): Promise<string | null>;
  tree(): Promise<TreeNode[]>;
  /** The open eden's manifest (eden.json). */
  manifest(): Promise<EdenManifestInfo>;
  /** Persist eden.json (goals, order, description). */
  saveManifest(manifest: EdenManifestInfo): Promise<void>;
  /** Persist settings.json (applies live; emits settings-changed). */
  saveSettings(settings: EdenSettings): Promise<void>;
  /** Subscribe to eden events; returns an unsubscribe. */
  onEvent(callback: (event: EdenEventPayload) => void): () => void;
}

export interface DiscoveredPluginDir {
  dir: string;
  manifestText: string | null;
}

export interface PluginsApi {
  discover(): Promise<DiscoveredPluginDir[]>;
  /** Copy a plugin folder into .eden/plugins/<id>/; resolves the new id. */
  installFromFolder(sourceDir: string): Promise<string>;
}

export interface SnapshotVersionInfo {
  name: string;
  sizeBytes: number;
  createdAtMs: number;
}

export interface ExportApi {
  /** Render print-clean HTML to a PDF inside the eden (Electron printToPDF). */
  renderPdf(html: string, outRelPath: string): Promise<void>;
}

export interface AppApi {
  /** Reveal an eden-relative path in the OS file manager. */
  revealPath(relPath: string): Promise<void>;
  /** The running app's version (package.json). */
  version(): Promise<string>;
  /** Open an https URL in the system browser (update check's only link). */
  openExternal(url: string): Promise<void>;
  /** Read a bundled first-party seed file (plugins/seed/, themes/ only). */
  readBundled(relPath: string): Promise<string>;
  /** Flip the built-in spellchecker (Settings → Editor, R4). */
  setSpellcheck(enabled: boolean): Promise<void>;
}

export interface HistoryApi {
  /** Snapshots holding a version of the file, newest first (§7.9). */
  versions(relPath: string): Promise<SnapshotVersionInfo[]>;
  /** One version's content, or null. */
  readVersion(snapshotName: string, relPath: string): Promise<string | null>;
  /** Snapshot the present, then write the old version (never rewrites history). */
  restore(snapshotName: string, relPath: string): Promise<WriteResult>;
}

/** File access scoped to the open eden (the plugin API's fs, §9.2). */
export interface PluginFsApi {
  read(relPath: string): Promise<string>;
  readBinary(relPath: string): Promise<Uint8Array>;
  write(relPath: string, content: string): Promise<void>;
  writeBinary(relPath: string, data: Uint8Array): Promise<void>;
  list(
    relPath: string,
  ): Promise<{ name: string; kind: "file" | "directory" | "other" }[]>;
  mkdir(relPath: string): Promise<void>;
  remove(relPath: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;
  stat(relPath: string): Promise<{
    kind: "file" | "directory";
    size: number;
    modifiedAtMs: number;
  } | null>;
}

export interface FilesApi {
  read(relPath: string): Promise<FileContents>;
  write(
    relPath: string,
    content: string,
    baseMtimeMs: number | null,
  ): Promise<WriteResult>;
  createFile(relPath: string): Promise<void>;
  createFolder(relPath: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  delete(relPath: string): Promise<void>;
}

export interface SearchHit {
  path: string;
  title: string;
  kind: string;
  snippet: string;
}

export interface FileSummary {
  path: string;
  title: string;
  kind: string;
  wordCount: number;
}

export interface EntitySummary {
  path: string;
  name: string;
  stableId: string | null;
  entityType: string | null;
  aliases: string[];
  /**
   * Legacy world name when the entity lives in an archived world
   * (`world/archived-worlds/<name>/`), else null.
   */
  world: string | null;
}

export interface SearchFilterInput {
  containerPath?: string;
  kind?: string;
  status?: string;
}

export interface LinkRefRow {
  sourcePath?: string;
  targetRaw?: string;
  kind: string;
  line: number;
}

export interface AppearanceRow {
  path: string;
  count: number;
}

export interface IndexedFileInfoRow {
  path: string;
  title: string;
  kind: string;
  wordCount: number;
  stableId: string | null;
  frontmatter: Record<string, unknown>;
}

export interface TimelineRow {
  path: string;
  title: string;
  storyDate: string;
  container: string;
  mentions: string[];
}

export interface CorkboardRow {
  path: string;
  title: string;
  status: string | null;
  synopsis: string;
  container: string;
}

/** Read-only index queries (§7.3, §9.2). */
export interface QueryApi {
  search(query: string, filter?: SearchFilterInput): Promise<SearchHit[]>;
  files(): Promise<FileSummary[]>;
  entities(): Promise<EntitySummary[]>;
  /** Resolve a `[[raw target]]` to an eden-relative path, or null. */
  resolveLink(raw: string): Promise<string | null>;
  backlinks(targetRaw: string): Promise<LinkRefRow[]>;
  outgoingLinks(sourcePath: string): Promise<LinkRefRow[]>;
  appearances(entityKey: string): Promise<AppearanceRow[]>;
  fileInfo(path: string): Promise<IndexedFileInfoRow | null>;
  /** Dated files with mention keys, for the timeline (§7.6). */
  timeline(): Promise<TimelineRow[]>;
  /** Corkboard cards (§7.7): title/synopsis/status per file. */
  corkboard(containerPrefix?: string): Promise<CorkboardRow[]>;
  /** Goals & streaks data (§7.8): totals plus a per-day series.
   * The container is a top-level folder; "." means the whole eden. */
  stats(
    container: string,
    days?: number,
  ): Promise<{
    total: number;
    today: number;
    series: { day: string; words: number }[];
  }>;
}

/** Present only when the app runs with EDENWRIGHT_TEST=1. */
export interface TestApi {
  snapshotNow(): Promise<string | null>;
  indexStats(): Promise<{ files: number }>;
  whenRebuilt(): Promise<void>;
}

export interface EdenwrightApi {
  /** Host platform as reported by the main process. */
  platform: EdenwrightPlatform;
  appVersion(): Promise<string>;
  window: WindowControls;
  app: AppApi;
  eden: EdenApi;
  files: FilesApi;
  query: QueryApi;
  plugins: PluginsApi;
  pluginfs: PluginFsApi;
  history: HistoryApi;
  exporter: ExportApi;
  test?: TestApi;
}
