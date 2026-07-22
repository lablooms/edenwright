/** One-off: install screenplay-mode, open a screenplay file, log console. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const sandbox = await mkdtemp(join(tmpdir(), "edenwright-dbg-"));

const app = await electron.launch({
  args: ["."],
  cwd: appRoot,
  env: { ...process.env, EDENWRIGHT_TEST: "1" },
});
const page = await app.firstWindow();
page.on("console", (msg) =>
  console.log("[console]", msg.type(), msg.text().slice(0, 300)),
);
page.on("pageerror", (err) =>
  console.log("[pageerror]", String(err).slice(0, 500)),
);

await page.evaluate(
  (parent) => window.edenwright.eden.create(parent, "Dbg Eden"),
  sandbox.replace(/\\/g, "/"),
);
await page.evaluate(async () => {
  await window.edenwright.projects.create({
    name: "Falling Up",
    preset: "feature-film",
    medium: "screenplay",
    scaffold: [{ path: "screenplay" }, { path: "codex" }, { path: "notes" }],
  });
  await window.edenwright.files.write(
    "Projects/Falling Up/screenplay/opening.md",
    "INT. ATTIC STUDIO - DAY\n\nDust turns in the light.\n",
    null,
  );
  await window.edenwright.test.whenRebuilt();
});
const id = await page.evaluate(
  (dir) => window.edenwright.plugins.installFromFolder(dir),
  join(appRoot, "..", "..", "plugins", "seed", "screenplay-mode").replace(
    /\\/g,
    "/",
  ),
);
console.log("installed", id);
await page.evaluate(async (pid) => {
  const state = await window.edenwright.eden.state();
  const settings = state.current.settings;
  await window.edenwright.eden.saveSettings({
    ...settings,
    plugins: {
      ...settings.plugins,
      enabled: [...settings.plugins.enabled, pid],
    },
  });
}, id);
await page.waitForTimeout(500);
await page.locator(".ew-modal button", { hasText: "Enable plugin" }).click();
await page.waitForTimeout(1000);
await page.evaluate(() =>
  window.__ewStores.app
    .getState()
    .openFileAt("Projects/Falling Up/screenplay/opening.md"),
);
await page.waitForTimeout(1500);
const editorCount = await page.locator(".markdown-editor").count();
console.log("markdown-editor count:", editorCount);

await app.close();
await rm(sandbox, { recursive: true, force: true });
