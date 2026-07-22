import { describe, expect, it } from "vitest";

import {
  compareSemver,
  isVersionAtLeast,
  validatePluginManifest,
} from "./validation.js";

const good = {
  id: "lablooms.hello-eden",
  name: "Hello, eden",
  version: "1.0.0",
  minAppVersion: "0.1.0-beta",
  description: "The plugin developers copy to start.",
  author: "Lablooms Studio",
};

describe("validatePluginManifest", () => {
  it("accepts a complete manifest", () => {
    const result = validatePluginManifest(good);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.id).toBe("lablooms.hello-eden");
  });

  it("rejects missing required fields with a readable error", () => {
    const { author, ...rest } = good;
    void author;
    const result = validatePluginManifest(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("author");
  });

  it("rejects non-semver versions", () => {
    expect(validatePluginManifest({ ...good, version: "v1" }).ok).toBe(false);
    expect(validatePluginManifest({ ...good, minAppVersion: "soon" }).ok).toBe(
      false,
    );
  });

  it("rejects junk shapes", () => {
    expect(validatePluginManifest(null).ok).toBe(false);
    expect(validatePluginManifest([]).ok).toBe(false);
    expect(validatePluginManifest("plugin").ok).toBe(false);
  });
});

describe("compareSemver / isVersionAtLeast", () => {
  it("orders versions numerically", () => {
    expect(compareSemver("0.1.0", "0.2.0")).toBeLessThan(0);
    expect(compareSemver("1.0.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareSemver("0.1.0", "0.1.0")).toBe(0);
  });

  it("treats beta suffixes by their numeric core", () => {
    expect(isVersionAtLeast("0.1.0-beta", "0.1.0-beta")).toBe(true);
    expect(isVersionAtLeast("0.1.0-beta", "0.2.0")).toBe(false);
  });
});
