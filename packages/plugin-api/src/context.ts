import type { FileSystemAdapter } from "@edenwright/core";

import type { CommandRegistry } from "./commands.js";
import type { EditorRegistry } from "./editor.js";
import type { EntityRegistry } from "./entities.js";
import type { FileEventRegistry } from "./events.js";
import type { ExporterRegistry } from "./exporters.js";
import type { IndexQueryApi } from "./index-queries.js";
import type { PluginManifest } from "./manifest.js";
import type { NoticeApi } from "./notices.js";
import type { PresetRegistry } from "./presets.js";
import type { SettingsRegistry } from "./settings.js";
import type { WorkspaceRegistry } from "./workspace.js";

/** File access scoped to the open eden. There is no API for paths outside it. */
export interface EdenAccess {
  /** Absolute, normalized path of the open eden's root folder. */
  rootPath: string;
  /** File system adapter for reads and atomic writes inside the eden. */
  fs: FileSystemAdapter;
}

/**
 * Everything a plugin can do (SPEC v2 §7.2). Handed to `onload` by the
 * runtime. First-party plugins consume exactly this surface — no backdoors.
 */
export interface PluginContext {
  readonly appVersion: string;
  readonly manifest: PluginManifest;
  readonly eden: EdenAccess;

  readonly commands: CommandRegistry;
  readonly workspace: WorkspaceRegistry;
  readonly editor: EditorRegistry;
  readonly settings: SettingsRegistry;
  readonly entities: EntityRegistry;
  readonly exporters: ExporterRegistry;
  readonly presets: PresetRegistry;
  readonly events: FileEventRegistry;
  readonly index: IndexQueryApi;
  readonly notices: NoticeApi;
}
