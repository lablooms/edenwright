import type { Disposable } from "./disposable.js";

/**
 * Exporters (SPEC v2 §7.2, §8). An exporter turns a project into files in the
 * project's `exports/` folder. Universal formats ship with the app; medium
 * conventions (Fountain, Ren'Py, …) arrive through this same hook in plugins.
 */

export interface ExportFormat {
  /** Format id, e.g. "docx", "epub", "fountain". */
  id: string;
  /** Dialog label, e.g. "Word (.docx)". */
  label: string;
  fileExtension: string;
}

export interface ExportRunContext {
  /** Eden-relative path of the project being exported. */
  projectPath: string;
  /** Eden-relative path of the output folder (usually `<project>/exports`). */
  outputDir: string;
  /** Structure-node ids selected in the export dialog; empty = everything. */
  scope: string[];
  /** File access scoped to the eden (eden-relative paths). */
  fs: import("@edenwright/core").FileSystemAdapter;
  /**
   * Render print-clean HTML to a PDF file (eden-relative out path). The
   * shell implements this with Electron's printToPDF — fast, offline (§10).
   */
  renderPdf(html: string, outRelPath: string): Promise<void>;
  /**
   * Write a zip archive of export files (eden-relative out path). Paths
   * inside the archive are relative to the project root.
   */
  writeZip(
    entries: { path: string; data: string | Uint8Array }[],
    outRelPath: string,
  ): Promise<void>;
  /** Report 0–1 progress for long exports. */
  reportProgress(fraction: number): void;
}

export interface ExporterDefinition {
  id: string;
  name: string;
  description?: string;
  /**
   * Medium tags this exporter serves ("prose", "screenplay", "comic", …).
   * Its formats appear in a project's export dialog when the project
   * preset's `medium` matches. Omit for universal exporters.
   */
  media?: string[];
  formats: ExportFormat[];
  run(format: string, context: ExportRunContext): Promise<void>;
}

export interface ExporterRegistry {
  register(exporter: ExporterDefinition): Disposable;
}
