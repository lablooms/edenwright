import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EdenwrightError } from "@edenwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeFileSystemAdapter } from "./node-file-system.js";

describe("NodeFileSystemAdapter", () => {
  let sandbox: string;
  const fs = new NodeFileSystemAdapter();

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "edenwright-test-"));
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  it("writes atomically: content lands and no temp file remains", async () => {
    const target = join(sandbox, "chapter one.md");
    await fs.writeFile(target, "Yuki counted the steps.");

    expect(await readFile(target, "utf8")).toBe("Yuki counted the steps.");
    const leftovers = (await readdir(sandbox)).filter((name) =>
      name.endsWith(".tmp"),
    );
    expect(leftovers).toEqual([]);
  });

  it("creates missing parent directories on write", async () => {
    const target = join(sandbox, "deep", "nested", "note.md");
    await fs.writeFile(target, "hello");
    expect(await fs.readFile(target)).toBe("hello");
  });

  it("overwrites an existing file cleanly", async () => {
    const target = join(sandbox, "scene.md");
    await fs.writeFile(target, "draft one");
    await fs.writeFile(target, "draft two");
    expect(await fs.readFile(target)).toBe("draft two");
  });

  it("throws NOT_FOUND when reading a missing file", async () => {
    await expect(fs.readFile(join(sandbox, "ghost.md"))).rejects.toThrow(
      EdenwrightError,
    );
  });

  it("stats files and directories", async () => {
    const file = join(sandbox, "a.md");
    await fs.writeFile(file, "four");
    expect(await fs.stat(file)).toMatchObject({ kind: "file", size: 4 });
    expect(await fs.stat(sandbox)).toMatchObject({ kind: "directory" });
    expect(await fs.stat(join(sandbox, "missing"))).toBeNull();
  });

  it("exists reflects reality", async () => {
    const file = join(sandbox, "b.md");
    expect(await fs.exists(file)).toBe(false);
    await fs.writeFile(file, "x");
    expect(await fs.exists(file)).toBe(true);
  });

  it("lists, moves, and removes", async () => {
    await fs.writeFile(join(sandbox, "one.md"), "1");
    await fs.writeFile(join(sandbox, "two.md"), "2");
    const names = (await fs.list(sandbox)).map((entry) => entry.name);
    expect(names.sort()).toEqual(["one.md", "two.md"]);
    expect(await fs.list(sandbox)).toContainEqual({
      name: "one.md",
      kind: "file",
    });

    await fs.move(join(sandbox, "one.md"), join(sandbox, "moved", "one.md"));
    expect(await fs.exists(join(sandbox, "moved", "one.md"))).toBe(true);

    await fs.remove(join(sandbox, "two.md"));
    expect(await fs.exists(join(sandbox, "two.md"))).toBe(false);
  });
});
