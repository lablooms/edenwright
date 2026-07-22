import { describe, expect, it } from "vitest";

import {
  basename,
  dirname,
  extname,
  isAbsolutePath,
  joinPath,
  normalizePath,
  relativePath,
} from "./paths.js";

describe("normalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("C:\\Users\\writer\\MyEden")).toBe(
      "C:/Users/writer/MyEden",
    );
  });

  it("collapses duplicate separators", () => {
    expect(normalizePath("/a//b///c")).toBe("/a/b/c");
  });

  it("strips a trailing slash but keeps the root", () => {
    expect(normalizePath("/a/b/")).toBe("/a/b");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("isAbsolutePath", () => {
  it("accepts posix roots and windows drives", () => {
    expect(isAbsolutePath("/home/writer")).toBe(true);
    expect(isAbsolutePath("C:/Users/writer")).toBe(true);
    expect(isAbsolutePath("d:\\eden")).toBe(true);
  });

  it("rejects relative paths", () => {
    expect(isAbsolutePath("Projects/Hollow Crown")).toBe(false);
    expect(isAbsolutePath("./notes")).toBe(false);
  });
});

describe("joinPath", () => {
  it("joins with single separators", () => {
    expect(joinPath("MyEden", "Projects", "Hollow Crown")).toBe(
      "MyEden/Projects/Hollow Crown",
    );
  });

  it("ignores empty segments and stray slashes", () => {
    expect(joinPath("/root/", "/a/", "/b")).toBe("/root/a/b");
    expect(joinPath("")).toBe(".");
  });
});

describe("basename / dirname / extname", () => {
  it("splits names from folders", () => {
    expect(basename("a/b/scene one.md")).toBe("scene one.md");
    expect(basename("scene one.md")).toBe("scene one.md");
    expect(dirname("a/b/scene one.md")).toBe("a/b");
    expect(dirname("scene one.md")).toBe(".");
    expect(dirname("/scene.md")).toBe("/");
  });

  it("reads extensions, lowercased, ignoring dotfiles", () => {
    expect(extname("CHAPTER.MD")).toBe(".md");
    expect(extname(".eden")).toBe("");
    expect(extname("no-extension")).toBe("");
  });
});

describe("relativePath", () => {
  it("computes downward and upward relatives", () => {
    expect(relativePath("/eden", "/eden/Projects/Hollow")).toBe(
      "Projects/Hollow",
    );
    expect(relativePath("/eden/Projects", "/eden/Worlds")).toBe("../Worlds");
  });

  it("returns dot for identical paths", () => {
    expect(relativePath("/eden", "/eden")).toBe(".");
  });
});
