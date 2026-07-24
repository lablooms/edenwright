import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SNIPPET_CLOSE,
  SNIPPET_OPEN,
  getBacklinks,
  listEntities,
  listIndexedFiles,
  rebuildIndex,
  searchIndex,
} from "@edenwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeFileSystemAdapter } from "./node-file-system.js";
import { SqliteIndexStorageAdapter } from "./sqlite-index.js";

describe("index queries over a real eden (§7.3, §7.4)", () => {
  let sandbox: string;
  const fs = new NodeFileSystemAdapter();
  let index: SqliteIndexStorageAdapter;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-query-"));
    index = new SqliteIndexStorageAdapter();
    await index.open(join(sandbox, "index.db"));

    await fs.writeFile(
      join(sandbox, "manuscript", "scene one.md"),
      '---\nid: scn_1\ntitle: "The Long Way Down"\nstatus: draft\n---\nYuki met the Gray Fox at the docks. @mira watched the rain.\n',
    );
    await fs.writeFile(
      join(sandbox, "world", "codex", "yuki.md"),
      '---\nid: ent_yuki\ntype: character\nname: "Yuki Harrow"\naliases: ["The Gray Fox"]\n---\nBackstory.\n',
    );
    await fs.writeFile(
      join(sandbox, "world", "notes", "history.md"),
      "# History\n\nA thousand years of rain over Aster Reach.\n",
    );
    await rebuildIndex(fs, index, sandbox);
  });

  afterEach(async () => {
    await index.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  it("full-text search ranks and marks snippets", () => {
    const hits = searchIndex(index, "rain");
    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => hit.path).sort()).toEqual([
      "manuscript/scene one.md",
      "world/notes/history.md",
    ]);
    expect(hits[0].snippet).toContain(SNIPPET_OPEN);
    expect(hits[0].snippet).toContain(SNIPPET_CLOSE);
  });

  it("filters by kind and status", () => {
    expect(searchIndex(index, "rain", { kind: "note" })).toHaveLength(1);
    expect(searchIndex(index, "rain", { status: "draft" })).toHaveLength(1);
    expect(searchIndex(index, "rain", { status: "final" })).toHaveLength(0);
  });

  it("lists files for the switcher", () => {
    const files = listIndexedFiles(index);
    expect(files).toHaveLength(3);
    expect(files[0].title).toBe("The Long Way Down");
  });

  it("lists codex entities with aliases for @ completion", () => {
    const entities = listEntities(index);
    expect(entities).toEqual([
      {
        path: "world/codex/yuki.md",
        name: "Yuki Harrow",
        stableId: "ent_yuki",
        entityType: "character",
        aliases: ["The Gray Fox"],
        world: null,
      },
    ]);
  });

  it("finds backlinks", () => {
    expect(getBacklinks(index, "mira")).toEqual([
      {
        sourcePath: "manuscript/scene one.md",
        kind: "mention",
        line: 6,
      },
    ]);
  });
});
