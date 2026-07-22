import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ensureIndexSchema,
  rebuildIndex,
  type FileRow,
  type LinkRow,
  type MentionRow,
} from "@edenwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeFileSystemAdapter } from "./node-file-system.js";
import { SqliteIndexStorageAdapter } from "./sqlite-index.js";

describe("SqliteIndexStorageAdapter", () => {
  let sandbox: string;
  let adapter: SqliteIndexStorageAdapter;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-index-"));
    adapter = new SqliteIndexStorageAdapter();
    await adapter.open(join(sandbox, "index.db"));
  });

  afterEach(async () => {
    await adapter.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  it("runs statements, queries rows, and executes scripts", () => {
    ensureIndexSchema(adapter);
    adapter.run("INSERT INTO meta (key, value) VALUES (?, ?)", ["k", "v"]);
    expect(adapter.query<{ value: string }>("SELECT value FROM meta")).toEqual(
      expect.arrayContaining([{ value: "v" }]),
    );
  });

  it("rolls back transactions that throw", () => {
    ensureIndexSchema(adapter);
    expect(() =>
      adapter.transaction(() => {
        adapter.run("INSERT INTO meta (key, value) VALUES (?, ?)", ["x", "1"]);
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(
      adapter.query("SELECT value FROM meta WHERE key = ?", ["x"]),
    ).toEqual([]);
  });
});

describe("rebuildIndex over real files (SPEC §12 M1)", () => {
  let sandbox: string;
  const fs = new NodeFileSystemAdapter();
  let adapter: SqliteIndexStorageAdapter;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-eden-"));
    adapter = new SqliteIndexStorageAdapter();
    await adapter.open(join(sandbox, "index.db"));
  });

  afterEach(async () => {
    await adapter.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  async function plantEden(): Promise<void> {
    // The adapter creates parent directories and writes atomically.
    await fs.writeFile(
      join(sandbox, "Projects", "Hollow Crown", "manuscript", "scene one.md"),
      '---\nid: scn_1\ntitle: "The Long Way Down"\n---\nYuki met [[The Gray Fox]]. @mira watched.\n',
    );
    await fs.writeFile(
      join(sandbox, "Projects", "Hollow Crown", "codex", "yuki.md"),
      '---\nid: ent_yuki\ntype: character\nname: "Yuki Harrow"\n---\nBackstory.\n',
    );
    await fs.writeFile(
      join(sandbox, "Worlds", "Aster Reach", "notes", "history.md"),
      "# History\n\nA thousand years of rain.\n",
    );
  }

  it("derives files, links, mentions, and full-text rows from plain files", async () => {
    await plantEden();
    const report = await rebuildIndex(fs, adapter, sandbox);
    expect(report.files).toBe(3);

    const files = adapter.query<FileRow>(
      "SELECT path, kind, stable_id, title, word_count FROM files ORDER BY path",
    );
    expect(files.map((row) => row.path)).toEqual([
      "Projects/Hollow Crown/codex/yuki.md",
      "Projects/Hollow Crown/manuscript/scene one.md",
      "Worlds/Aster Reach/notes/history.md",
    ]);
    expect(files[0]).toMatchObject({
      kind: "codex",
      stable_id: "ent_yuki",
      title: "Yuki Harrow",
    });

    const links = adapter.query<LinkRow>(
      "SELECT target_raw, kind FROM links ORDER BY target_raw",
    );
    expect(links).toEqual([
      { target_raw: "The Gray Fox", kind: "wiki" },
      { target_raw: "mira", kind: "mention" },
    ]);

    const mentions = adapter.query<MentionRow>(
      "SELECT entity_key, count FROM mentions",
    );
    expect(mentions).toEqual([{ entity_key: "mira", count: 1 }]);

    const fts = adapter.query<{ path: string }>(
      "SELECT path FROM files_fts WHERE files_fts MATCH ?",
      ["rain"],
    );
    expect(fts).toEqual([{ path: "Worlds/Aster Reach/notes/history.md" }]);
  });

  it("deleting index.db is a non-event: a fresh database rebuilds identically", async () => {
    await plantEden();
    const first = await rebuildIndex(fs, adapter, sandbox);
    await adapter.close();

    await rm(join(sandbox, "index.db"), { force: true });
    await rm(join(sandbox, "index.db-wal"), { force: true });
    await rm(join(sandbox, "index.db-shm"), { force: true });

    adapter = new SqliteIndexStorageAdapter();
    await adapter.open(join(sandbox, "index.db"));
    const second = await rebuildIndex(fs, adapter, sandbox);

    expect(second.files).toBe(first.files);
    expect(adapter.query("SELECT path FROM files")).toHaveLength(3);
  });
});
