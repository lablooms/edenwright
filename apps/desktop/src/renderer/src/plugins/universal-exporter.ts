import {
  collectSections,
  sanitizeFileName,
  toCleanMarkdown,
  toEpub,
  toManuscriptDocx,
  toManuscriptHtml,
  toSingleHtml,
} from "@edenwright/exporters";
import type { ExporterDefinition } from "@edenwright/plugin-api";

/**
 * The built-in universal exporter (SPEC v2 §8): format plumbing every
 * project gets — medium conventions (Fountain, Ren'Py, …) belong to medium
 * plugins. Registered by the app at startup, not a plugin.
 */
export const universalExporter: ExporterDefinition = {
  id: "edenwright.exporter.universal",
  name: "Universal exports",
  description: "Word, EPUB, PDF, Markdown, HTML, zip — for every project.",
  formats: [
    { id: "docx", label: "Word (.docx)", fileExtension: "docx" },
    { id: "epub", label: "EPUB (.epub)", fileExtension: "epub" },
    { id: "pdf", label: "PDF (.pdf)", fileExtension: "pdf" },
    { id: "markdown", label: "Clean Markdown (.md)", fileExtension: "md" },
    { id: "html", label: "Single-file HTML (.html)", fileExtension: "html" },
    { id: "zip", label: "Markdown bundle (.zip)", fileExtension: "zip" },
  ],
  async run(format, context) {
    const sections = await collectSections(context.fs, context.projectPath);
    const projectName =
      context.projectPath.split("/").filter(Boolean).pop() ?? "project";
    const input = { projectName, sections };
    const base = `${context.outputDir}/${sanitizeFileName(projectName)}`;

    switch (format) {
      case "docx":
        await context.fs.writeFileBinary(
          `${base}.docx`,
          await toManuscriptDocx(input),
        );
        return;
      case "epub":
        await context.fs.writeFileBinary(`${base}.epub`, await toEpub(input));
        return;
      case "pdf":
        await context.renderPdf(toManuscriptHtml(input), `${base}.pdf`);
        return;
      case "markdown":
        await context.fs.writeFile(`${base}.md`, toCleanMarkdown(input));
        return;
      case "html":
        await context.fs.writeFile(`${base}.html`, toSingleHtml(input));
        return;
      case "zip":
        await context.writeZip(
          sections.map((section) => ({
            path: section.path.slice(context.projectPath.length + 1),
            data: `${section.body.trim()}\n`,
          })),
          `${base}-markdown.zip`,
        );
        return;
      default:
        throw new Error(`Unknown universal export format: ${format}`);
    }
  },
};
