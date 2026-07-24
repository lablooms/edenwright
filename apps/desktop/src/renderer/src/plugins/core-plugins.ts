import {
  validatePluginManifest,
  type PluginManifest,
} from "@edenwright/plugin-api";

/**
 * Core plugins (R5): the first-party seeds that ship inside the app bundle
 * (`plugins/seed/`). They are not installed — an enabled core plugin is read
 * straight from the bundle via the main process's allow-listed bundle reader,
 * so there is nothing to copy, nothing to trust-prompt, and nothing to
 * uninstall. `settings.plugins.coreDisabled` holds the ones turned off.
 */

/** Directory names under `plugins/seed/`, in the order the list shows them. */
export const CORE_PLUGIN_DIRS = [
  "screenplay-mode",
  "comic-rail",
  "story-canvas",
  "medium-exporters",
  "sprints",
  "stats-deluxe",
  "namesmith",
  "structure-wizards",
] as const;

export interface CorePluginInfo {
  /** Folder name inside `plugins/seed/` (also the bundle path segment). */
  dir: string;
  manifest: PluginManifest;
}

let cache: CorePluginInfo[] | null = null;

/**
 * Read and validate every core plugin's manifest from the bundle. A seed
 * that fails validation is skipped — one bad build must not blank the list.
 */
export async function listCorePlugins(): Promise<CorePluginInfo[]> {
  if (cache) return cache;
  const result: CorePluginInfo[] = [];
  for (const dir of CORE_PLUGIN_DIRS) {
    try {
      const text = await window.edenwright.app.readBundled(
        `plugins/seed/${dir}/manifest.json`,
      );
      const validation = validatePluginManifest(JSON.parse(text));
      if (validation.ok) result.push({ dir, manifest: validation.manifest });
    } catch {
      // A missing/broken seed is a build problem, not the writer's — skip.
    }
  }
  cache = result;
  return result;
}

/** One payload file of a core plugin, straight from the app bundle. */
export function readCorePluginFile(
  dir: string,
  fileName: string,
): Promise<string> {
  return window.edenwright.app.readBundled(`plugins/seed/${dir}/${fileName}`);
}
