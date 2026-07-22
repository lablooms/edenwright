import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron, expect, test } from "@playwright/test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// M0 smoke: the empty app opens looking unmistakably like SPEC §3 —
// void background, branded title bar, designed empty state.
test("app opens in the Edenwright look", async () => {
  const app = await electron.launch({
    args: [".", ...(process.env.CI ? ["--no-sandbox"] : [])],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();

  await expect(page).toHaveTitle("Edenwright");
  await expect(page.locator(".ew-titlebar")).toBeVisible();
  await expect(page.locator(".ew-titlebar__wordmark")).toHaveText("Edenwright");
  await expect(page.locator(".welcome__title")).toHaveText(
    "Every story needs a garden.",
  );

  // --ew-void #0B0713, token-driven — never a default gray box (§11).
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(11, 7, 19)",
  );

  const artifactsDir = join(appRoot, "e2e", "artifacts");
  await mkdir(artifactsDir, { recursive: true });
  await page.screenshot({ path: join(artifactsDir, "edenwright-m0.png") });

  await app.close();
});
