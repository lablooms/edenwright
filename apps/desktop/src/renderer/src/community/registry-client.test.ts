import { describe, expect, it } from "vitest";

import { assetUrl, compareVersions } from "./registry-client";

describe("registry client", () => {
  it("assetUrl builds a release-download URL", () => {
    expect(
      assetUrl(
        {
          id: "x",
          name: "X",
          version: "1.0.0",
          description: "",
          author: "",
          repo: "lablooms/edenwright",
          releaseTag: "seed-x-v1.0.0",
        },
        "main.js",
      ),
    ).toBe(
      "https://github.com/lablooms/edenwright/releases/download/seed-x-v1.0.0/main.js",
    );
  });

  it("compareVersions orders semver-ish strings", () => {
    expect(compareVersions("1.10.0", "1.2.0")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("0.1.0-beta", "0.1.0")).toBeLessThan(0);
    expect(compareVersions("0.2.0", "0.1.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
  });
});
