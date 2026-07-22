import type { PluginContext } from "./context.js";
import type { PluginManifest } from "./manifest.js";

/**
 * An Edenwright plugin (SPEC §9.1). A plugin is a folder with a manifest and
 * a `main.js` default-exporting this shape.
 */
export interface EdenwrightPlugin {
  readonly manifest: PluginManifest;
  /** Called when the plugin is enabled. Register everything here. */
  onload(context: PluginContext): void | Promise<void>;
  /** Called when disabled. Disposables are auto-disposed; use for the rest. */
  onunload?(): void | Promise<void>;
}

/**
 * Identity helper for typed plugin authoring:
 * `export default definePlugin({ ... })` type-checks against the API.
 */
export function definePlugin(plugin: EdenwrightPlugin): EdenwrightPlugin {
  return plugin;
}
