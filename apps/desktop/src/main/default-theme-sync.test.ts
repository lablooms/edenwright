import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");

/**
 * SPEC §9.5: the default theme is a real theme package. Its theme.css is a
 * byte-copy of the app's base tokens — this test is the anti-drift treaty
 * between the two (SPEC §5.2 layout, §3.1 palette).
 */
describe("themes/edenwright-dark (SPEC §9.5)", () => {
  it("theme.css matches the base tokens exactly", async () => {
    // Line endings are a checkout detail (autocrlf), not a difference.
    const normalize = (text: string) => text.replace(/\r\n/g, "\n");
    const [tokens, theme] = await Promise.all([
      readFile(join(repoRoot, "packages/ui/src/styles/tokens.css"), "utf8"),
      readFile(join(repoRoot, "themes/edenwright-dark/theme.css"), "utf8"),
    ]);
    expect(normalize(theme)).toBe(normalize(tokens));
  });

  it("manifest declares the built-in default id", async () => {
    const manifest = JSON.parse(
      await readFile(
        join(repoRoot, "themes/edenwright-dark/manifest.json"),
        "utf8",
      ),
    ) as { id?: string; name?: string };
    expect(manifest.id).toBe("edenwright-dark");
    expect(manifest.name).toBe("Edenwright Dark");
  });
});
