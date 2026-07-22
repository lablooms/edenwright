import { countWords } from "@edenwright/core";
import { AlignmentType, Document, Paragraph, TextRun } from "docx";

import { packDocx } from "./docx-pack.js";
import JSZip from "jszip";

import { markdownToHtml } from "./markdown-to-html.js";
import type { ExportSection } from "./sections.js";

/**
 * Prose exports (SPEC §8.1, §10): clean markdown, standard manuscript docx,
 * EPUB 3, and print-clean HTML for PDF.
 */

export interface ProseExportInput {
  projectName: string;
  author?: string;
  sections: ExportSection[];
}

/** Clean markdown: one document, titles as headings, sections separated. */
export function toCleanMarkdown(input: ProseExportInput): string {
  const parts = [`# ${input.projectName}\n`];
  for (const section of input.sections) {
    parts.push(`\n## ${section.title}\n\n${section.body.trim()}\n`);
  }
  return parts.join("\n");
}

/** docx standard manuscript format: Times 12, double-spaced, title page. */
export async function toManuscriptDocx(
  input: ProseExportInput,
): Promise<Uint8Array> {
  const totalWords = input.sections.reduce(
    (sum, section) => sum + countWords(section.body),
    0,
  );
  const author = input.author ?? "Anonymous";

  const children: Paragraph[] = [
    new Paragraph({ spacing: { before: 4800 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: input.projectName, bold: true, size: 32 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `by ${author}`, size: 24 })],
      pageBreakBefore: false,
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `${totalWords.toLocaleString("en-US")} words`,
          size: 22,
          italics: true,
        }),
      ],
      pageBreakBefore: true,
    }),
  ];

  for (const [index, section] of input.sections.entries()) {
    if (index > 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "#", size: 24 })],
          spacing: { before: 480, after: 480 },
        }),
      );
    }
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: section.title, bold: true, size: 28 })],
        spacing: { before: 480, after: 480 },
      }),
    );
    for (const para of section.body.trim().split(/\n{2,}/)) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: para.replace(/\n/g, " "),
              size: 24,
              font: "Times New Roman",
            }),
          ],
          // 480 twips (24pt on 12pt) with auto rule = double spacing (SMF).
          spacing: { line: 480, lineRule: "auto", after: 0 },
          indent: { firstLine: 720 },
        }),
      );
    }
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });
  return packDocx(document);
}

const XHTML_HEAD = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head><meta charset="utf-8" /><title>%%TITLE%%</title></head>
<body>
`;
const XHTML_TAIL = "</body>\n</html>\n";

/** EPUB 3 via JSZip (SPEC §10 — dependency-light assembly). */
export async function toEpub(input: ProseExportInput): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  );

  const uid = `edenwright-${input.projectName.replace(/\W+/g, "-").toLowerCase()}`;
  const manifestItems: string[] = [];
  const spineItems: string[] = [];

  zip.file(
    "OEBPS/nav.xhtml",
    XHTML_HEAD.replace("%%TITLE%%", `${input.projectName} — Contents`) +
      `<nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>\n` +
      input.sections
        .map(
          (section, index) =>
            `<li><a href="chap-${index + 1}.xhtml">${escapeXml(section.title)}</a></li>`,
        )
        .join("\n") +
      `</ol></nav>\n` +
      XHTML_TAIL,
  );
  manifestItems.push(
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
  );

  for (const [index, section] of input.sections.entries()) {
    const id = `chap-${index + 1}`;
    zip.file(
      `OEBPS/${id}.xhtml`,
      XHTML_HEAD.replace("%%TITLE%%", escapeXml(section.title)) +
        `<h1>${escapeXml(section.title)}</h1>\n` +
        markdownToHtml(section.body) +
        "\n" +
        XHTML_TAIL,
    );
    manifestItems.push(
      `<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`<itemref idref="${id}"/>`);
  }

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package version="3.0" unique-identifier="uid" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${escapeXml(uid)}</dc:identifier>
    <dc:title>${escapeXml(input.projectName)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>${escapeXml(input.author ?? "Anonymous")}</dc:creator>
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine>
    ${spineItems.join("\n    ")}
  </spine>
</package>
`,
  );

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

/** Print-clean manuscript HTML for the shell's printToPDF (SPEC §10). */
export function toManuscriptHtml(input: ProseExportInput): string {
  const body = input.sections
    .map(
      (section) => `
  <section>
    <h1>${escapeXml(section.title)}</h1>
    ${markdownToHtml(section.body)}
  </section>`,
    )
    .join("\n<hr/>\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeXml(input.projectName)}</title>
<style>
  @page { size: Letter; margin: 1in; }
  body { font-family: "Literata", Georgia, serif; font-size: 12pt; line-height: 1.9; color: #111; }
  h1 { text-align: center; font-size: 16pt; margin: 0 0 24pt; }
  hr { border: none; border-top: 1px solid #999; margin: 24pt auto; width: 40%; }
  blockquote { border-left: 2px solid #999; padding-left: 12pt; color: #444; }
  pre { font-family: monospace; background: #f4f4f4; padding: 8pt; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** Reader-friendly single-file HTML (universal export, SPEC v2 §8). */
export function toSingleHtml(input: ProseExportInput): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeXml(input.projectName)}</title>
<style>
  body { font-family: Georgia, serif; font-size: 17px; line-height: 1.7; color: #1d1d1d; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; }
  h1 { text-align: center; }
  h2 { margin-top: 3rem; }
  blockquote { border-left: 2px solid #999; padding-left: 1rem; color: #444; }
  code { background: #f4f4f4; padding: 0 4px; border-radius: 3px; }
  pre { font-family: monospace; background: #f4f4f4; padding: 8pt; }
</style>
</head>
<body>
<h1>${escapeXml(input.projectName)}</h1>
${input.sections
  .map(
    (section) =>
      `<h2>${escapeXml(section.title)}</h2>\n${markdownToHtml(section.body)}`,
  )
  .join("\n")}
</body>
</html>
`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
