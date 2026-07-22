import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { expectGolden, PROSE_FIXTURE } from "./golden.js";
import {
  toCleanMarkdown,
  toEpub,
  toManuscriptDocx,
  toManuscriptHtml,
} from "./prose-formats.js";

describe("prose formats (golden)", () => {
  it("clean markdown", () => {
    expectGolden("prose.md", toCleanMarkdown(PROSE_FIXTURE));
  });

  it("manuscript HTML for PDF", () => {
    expectGolden("prose-manuscript.html", toManuscriptHtml(PROSE_FIXTURE));
  });

  it("manuscript docx contains the title, author, and sections", async () => {
    const bytes = await toManuscriptDocx(PROSE_FIXTURE);
    const zip = await JSZip.loadAsync(bytes);
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).toContain("Hollow Crown");
    expect(document).toContain("by Lablooms");
    expect(document).toContain("The Long Way Down");
    expect(document).toContain("The Door");
    expect(document).toContain("Times New Roman");
    expect(document).toContain('w:line="480"');
  });

  it("EPUB has mimetype, container, opf, nav, and chapters", async () => {
    const bytes = await toEpub(PROSE_FIXTURE);
    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file("mimetype")!.async("string")).toBe(
      "application/epub+zip",
    );
    expect(await zip.file("META-INF/container.xml")!.async("string")).toContain(
      "content.opf",
    );
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("<dc:title>Hollow Crown</dc:title>");
    const nav = await zip.file("OEBPS/nav.xhtml")!.async("string");
    expect(nav).toContain("The Long Way Down");
    const chapter = await zip.file("OEBPS/chap-1.xhtml")!.async("string");
    expect(chapter).toContain("<strong>ninety-nine</strong>");
    expectGolden("prose-chap-1.xhtml", chapter);
  });
});
