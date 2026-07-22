import { describe, expect, it } from "vitest";

import { markdownToHtml } from "./markdown-to-html.js";

describe("markdownToHtml", () => {
  it("converts headings, emphasis, paragraphs, and strips frontmatter", () => {
    const out = markdownToHtml(
      '---\ntitle: "X"\n---\n# The Long Way Down\n\nYuki counted **ninety-nine** steps, *slowly*.\n',
    );
    expect(out).toContain("<h1>The Long Way Down</h1>");
    expect(out).toContain(
      "<p>Yuki counted <strong>ninety-nine</strong> steps, <em>slowly</em>.</p>",
    );
    expect(out).not.toContain("title");
  });

  it("handles code, quotes, lists, and escapes HTML", () => {
    const out = markdownToHtml(
      "> a > b & c\n\n- one\n- two\n\n```\nconst x = 1 < 2;\n```\n",
    );
    expect(out).toContain("<blockquote><p>a &gt; b &amp; c</p></blockquote>");
    expect(out).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(out).toContain("<pre><code>const x = 1 &lt; 2;</code></pre>");
  });

  it("strips %%comments%% and unwraps links", () => {
    const out = markdownToHtml(
      "Text %%secret%% with [a link](https://x.y) and [[A Place]] and @yuki.\n",
    );
    expect(out).not.toContain("secret");
    expect(out).toContain("a link");
    expect(out).toContain("A Place");
    expect(out).toContain("@yuki");
  });
});
