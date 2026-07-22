import { describe, expect, it } from "vitest";

import {
  conflictedCopyName,
  countWords,
  deriveFile,
  kindFromPath,
} from "./file-model.js";

describe("countWords", () => {
  it("counts prose words, keeping contractions and hyphenation", () => {
    expect(countWords("Yuki counted the steps as she fell.")).toBe(7);
    expect(countWords("don't stop half-way")).toBe(3);
  });

  it("ignores code fences and inline code", () => {
    const text =
      "Before `secret code words` after\n```\nfenced words\n```\nDone.";
    expect(countWords(text)).toBe(3); // Before, after, Done
  });

  it("handles unicode prose", () => {
    expect(countWords("Вики читает книгу")).toBe(3);
  });
});

describe("deriveFile", () => {
  it("derives links, mentions, title, and counts", () => {
    const text = [
      "---",
      "id: scn_1",
      "status: draft",
      "storyDate: 1042-03-17",
      "---",
      "# The Long Way Down",
      "",
      "Yuki met [[The Gray Fox]] and [[Aster Reach|the city]].",
      "Later @yuki argued with @Mira, then @yuki left.",
      "`@not-a-mention`",
    ].join("\n");
    const derived = deriveFile("scene one.md", text);

    expect(derived.stableId).toBe("scn_1");
    expect(derived.status).toBe("draft");
    expect(derived.storyDate).toBe("1042-03-17");
    expect(derived.title).toBe("The Long Way Down");

    const wiki = derived.links.filter((link) => link.kind === "wiki");
    expect(wiki.map((link) => link.targetRaw)).toEqual([
      "The Gray Fox",
      "Aster Reach",
    ]);
    expect(wiki[0].line).toBe(8);

    expect(derived.mentions).toEqual([
      { entityKey: "yuki", count: 2 },
      { entityKey: "mira", count: 1 },
    ]);
    expect(
      derived.links.some(
        (link) => link.kind === "mention" && link.targetRaw === "not-a-mention",
      ),
    ).toBe(false);
  });

  it("prefers frontmatter title over heading and filename", () => {
    expect(
      deriveFile("x.md", "---\ntitle: From Frontmatter\n---\n# Heading\n")
        .title,
    ).toBe("From Frontmatter");
    expect(deriveFile("scene one.md", "plain text").title).toBe("scene one");
  });
});

describe("kindFromPath", () => {
  it("classifies by folder", () => {
    expect(kindFromPath("Projects/Hollow/manuscript/scene.md")).toBe(
      "manuscript",
    );
    expect(kindFromPath("Projects/Hollow/codex/yuki.md")).toBe("codex");
    expect(kindFromPath("Worlds/Aster/notes/history.md")).toBe("note");
  });
});

describe("conflictedCopyName", () => {
  it("follows the SPEC §5.4 naming", () => {
    const date = new Date(2026, 6, 21, 1, 2, 3);
    expect(conflictedCopyName("Projects/H/scene.md", date)).toBe(
      "Projects/H/scene (conflicted copy 2026-07-21 01-02-03).md",
    );
    expect(conflictedCopyName("note", date)).toBe(
      "note (conflicted copy 2026-07-21 01-02-03)",
    );
  });
});
