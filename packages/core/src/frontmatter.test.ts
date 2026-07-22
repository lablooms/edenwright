import { describe, expect, it } from "vitest";

import { parseMarkdown, serializeMarkdown } from "./frontmatter.js";

describe("parseMarkdown", () => {
  it("parses frontmatter and body", () => {
    const text =
      '---\nid: scn_1\ntitle: "The Long Way Down"\n---\nYuki fell.\n';
    const parsed = parseMarkdown(text);
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.data).toEqual({ id: "scn_1", title: "The Long Way Down" });
    expect(parsed.body).toBe("Yuki fell.\n");
  });

  it("treats missing frontmatter as plain body", () => {
    const parsed = parseMarkdown("Just prose.\n");
    expect(parsed.hasFrontmatter).toBe(false);
    expect(parsed.data).toEqual({});
    expect(parsed.body).toBe("Just prose.\n");
  });

  it("handles CRLF documents", () => {
    const parsed = parseMarkdown("---\r\nid: scn_1\r\n---\r\nBody.\r\n");
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.data.id).toBe("scn_1");
    expect(parsed.body).toBe("Body.\r\n");
  });

  it("never swallows the body on invalid YAML", () => {
    const text = "---\n{unclosed: [\n---\nPrecious words.\n";
    const parsed = parseMarkdown(text);
    expect(parsed.frontmatterError).toBeTruthy();
    expect(parsed.body).toBe(text);
    expect(parsed.data).toEqual({});
  });

  it("treats non-object frontmatter as empty data", () => {
    const parsed = parseMarkdown("---\n- a\n- b\n---\nBody.\n");
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.data).toEqual({});
    expect(parsed.body).toBe("Body.\n");
  });
});

describe("serializeMarkdown", () => {
  it("round-trips with parseMarkdown", () => {
    const data = { id: "scn_1", title: "T", words: 12 };
    const body = "Once upon a time.\n";
    const parsed = parseMarkdown(serializeMarkdown(data, body));
    expect(parsed.data).toEqual(data);
    expect(parsed.body).toBe(body);
  });

  it("emits no frontmatter block for empty data", () => {
    expect(serializeMarkdown({}, "Just prose.\n")).toBe("Just prose.\n");
  });
});
