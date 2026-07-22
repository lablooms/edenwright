import type { Extension } from "@codemirror/state";

import type { Disposable } from "./disposable.js";

/**
 * Editor extension points (SPEC v2 §7.2). Edenwright's editor is CodeMirror
 * 6; plugins contribute real CM6 extensions. Medium plugins (screenplay
 * mode, comic rail) register a FACTORY and gate by the document's medium.
 */

/** Context handed to an extension factory for each editor instance. */
export interface EditorExtensionContext {
  /** Eden-relative path of the file in this editor. */
  filePath: string;
  /** The owning project preset's medium tag, when the file is in a project. */
  medium: string | null;
  /** The owning project preset's id, when the file is in a project. */
  preset: string | null;
}

export type EditorExtensionFactory = (
  context: EditorExtensionContext,
) => Extension | null;

export interface EditorRegistry {
  /**
   * Register a CM6 extension for every editor, or a factory computed per
   * editor — return null to sit that editor out (medium gating).
   */
  registerExtension(extension: Extension | EditorExtensionFactory): Disposable;
}
