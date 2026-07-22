import type { Disposable } from "./disposable.js";

/**
 * Presets (SPEC v2 §6). There are no engines: every medium shares one story
 * skeleton, and a preset is pure data describing a medium — terminology,
 * structure, defaults, scaffold. Community presets ship with zero code.
 */

/** One level of a project's structure tree, e.g. "Part", "Chapter", "Scene". */
export interface StructureLevel {
  id: string;
  label: string;
  /** When false, presets may collapse this level out of the tree. */
  required?: boolean;
}

/** A file or folder stamped when a project is created from the preset. */
export interface ScaffoldEntry {
  /** Project-relative path (folder when `contents` is omitted). */
  path: string;
  contents?: string;
}

export interface PresetDefinition {
  /** Preset id, e.g. "novel", "manga", "feature-film". */
  id: string;
  name: string;
  description?: string;
  /** Lucide icon name. */
  icon?: string;
  /**
   * Medium tag — the join for exporters and medium plugins. Built-ins:
   * "prose", "screenplay", "comic", "interactive", "world". Free-form by
   * design: community media are welcome.
   */
  medium: string;
  /** What this medium calls its documents ("Scene"/"Scenes", "Page"/"Pages"). */
  terminology: { document: string; documents: string };
  /** The preset's structure tree (folders in the project). */
  structure: StructureLevel[];
  /** Default frontmatter field values stamped on new documents. */
  defaultFields: Record<string, unknown>;
  /** Files/folders created with the project. */
  scaffold: ScaffoldEntry[];
  /** Where the preset's works live: `Projects/` or `Worlds/`. */
  home?: "projects" | "worlds";
  /** Preferred export format ids; the first is the dialog's default. */
  exportDefaults?: string[];
  /** Plugin ids worth suggesting (e.g. screenplay-mode for film presets). */
  suggestedPlugins?: string[];
}

export interface PresetRegistry {
  /** Register a preset — the zero-code path to a new medium. */
  register(preset: PresetDefinition): Disposable;
}
