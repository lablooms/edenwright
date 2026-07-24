export type { PlatformAdapters } from "./adapters/index.js";
export * from "./adapters/index.js";

export { EdenwrightError, type EdenwrightErrorCode } from "./errors.js";

export {
  basename,
  dirname,
  extname,
  isAbsolutePath,
  joinPath,
  normalizePath,
  relativePath,
} from "./paths.js";

export { newId } from "./ids.js";

export {
  DEFAULT_EDEN_SETTINGS,
  SNAPSHOT_DEFAULT_INTERVAL_MINUTES,
  SNAPSHOT_DEFAULT_MAX_TOTAL_BYTES,
  parseEdenSettings,
  type BundledEditorFont,
  type EdenSettings,
  type EditorSettings,
  type SnapshotSettings,
  type ThemeSettings,
} from "./settings.js";

export {
  EDEN_EXPORTS_DIR,
  EDEN_INDEX_FILE,
  EDEN_MANIFEST_FILE,
  EDEN_META_DIR,
  EDEN_PLUGINS_DIR,
  EDEN_SETTINGS_FILE,
  EDEN_SNAPSHOTS_DIR,
  EDEN_THEMES_DIR,
  EDEN_WELCOME_FILE,
  EDEN_WORLD_DIR,
  LEGACY_PROJECTS_DIR,
  LEGACY_WORLDS_DIR,
  type EdenInfo,
} from "./model/eden.js";

export {
  parseEdenManifest,
  parseLegacyProjectManifest,
  parseLegacyWorldManifest,
  serializeManifest,
  type EdenGoals,
  type EdenManifest,
  type LegacyProjectManifest,
  type LegacyWorldManifest,
} from "./model/manifests.js";

export {
  parseMarkdown,
  serializeMarkdown,
  type ParsedMarkdown,
} from "./frontmatter.js";

export {
  conflictedCopyName,
  countWords,
  deriveFile,
  kindFromPath,
  stripCode,
  type DerivedFile,
  type DerivedLink,
  type DerivedMention,
  type FileKind,
} from "./file-model.js";

export { walkFiles, type WalkOptions } from "./walk.js";

export {
  INDEX_SCHEMA_SQL,
  INDEX_SCHEMA_VERSION,
  type FileRow,
  type LinkRow,
  type MentionRow,
} from "./index-schema.js";

export {
  ensureIndexSchema,
  indexFile,
  readSchemaVersion,
  rebuildIndex,
  removeIndexedFile,
  updateDailyWords,
  type RebuildReport,
} from "./indexer.js";

export {
  planSnapshotPruning,
  snapshotFileName,
  type SnapshotInfo,
} from "./snapshot-policy.js";

export {
  createEden,
  isEden,
  loadEdenManifest,
  loadEdenSettings,
  needsMigration,
  saveEdenManifest,
  saveEdenSettings,
  validateEdenName,
  welcomeNoteContents,
  type CreateEdenInput,
  type ScaffoldInput,
} from "./eden-structure.js";

export { ensureWorldDirs, WORLD_SUBDIRS } from "./world-structure.js";

export { migrateLegacyEden, type LegacyMigrationReport } from "./migration.js";

export {
  BUILTIN_PRESETS,
  findBuiltinPreset,
  type BuiltinPreset,
} from "./presets.js";

export {
  BUILTIN_ENTITY_TYPES,
  mentionKeyForName,
  parseEntity,
  serializeEntity,
  type EntityFieldDef,
  type EntityTypeDef,
  type ParsedEntity,
} from "./codex.js";

export {
  findTimelineCollisions,
  ordinalToStoryDate,
  storyDateToOrdinal,
  type TimelineCollision,
} from "./timeline.js";

export { diffLines, type DiffLine } from "./diff.js";

export {
  DEFAULT_THEME_ID,
  parseThemeManifest,
  type InstalledTheme,
  type ThemeManifest,
} from "./theme.js";

export { resolveLinkTarget, type LinkTargetFile } from "./links.js";

export { buildFtsQuery } from "./search-query.js";

export {
  getBacklinks,
  getEntityAppearances,
  getIndexedFileInfo,
  getOutgoingLinks,
  listEntities,
  listIndexedEntities,
  listIndexedFiles,
  searchIndex,
  SNIPPET_CLOSE,
  SNIPPET_OPEN,
  type IndexedEntitySummary,
  type IndexedFileSummary,
  type SearchFilter,
  type SearchHitRow,
} from "./index-queries.js";
