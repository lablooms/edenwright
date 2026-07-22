/** One-off: drive the Codex PANEL UI exactly like a user would. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const sandbox = await mkdtemp(join(tmpdir(), "edenwright-dbgcdx-"));
const app = await electron.launch({
  args: ["."],
  cwd: appRoot,
  env: { ...process.env, EDENWRIGHT_TEST: "1" },
});
const page = await app.firstWindow();
page.on("console", (m) => {
  if (m.type() === "error") console.log("[err]", m.text().slice(0, 300));
});
page.on("pageerror", (e) =>
  console.log("[pageerror]", String(e).slice(0, 400)),
);

await page.evaluate(
  (p) => window.edenwright.eden.create(p, "Dbg"),
  sandbox.replace(/\\/g, "/"),
);
await page.evaluate(async () => {
  await window.edenwright.projects.create({
    name: "Hollow Crown",
    preset: "novel",
    medium: "prose",
    scaffold: [{ path: "manuscript" }, { path: "codex" }, { path: "notes" }],
  });
  await window.edenwright.test.whenRebuilt();
});
await page.locator(".ew-sidebar").waitFor({ timeout: 30000 });

// 1. Codex rail → panel
await page.locator('.ew-sidebar button[aria-label="Codex"]').click();
await page.waitForTimeout(600);
console.log("panel visible:", await page.locator(".codex-panel").count());

// 2. + → create entity via the form
await page.locator(".codex-panel__new").click();
console.log("create form:", await page.locator(".codex-panel__create").count());
console.log(
  "container options:",
  await page.locator(".codex-panel__select option").allTextContents(),
);
await page.locator(".codex-panel__name").fill("Yuki Harrow");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
console.log(
  "entities in panel:",
  await page.locator(".codex-panel__entity").count(),
);
console.log("sheet:", await page.locator(".codex-sheet").count());

// 3. @-completion in a manuscript file
await page.evaluate(async () => {
  await window.edenwright.files.write(
    "Projects/Hollow Crown/manuscript/one.md",
    "The fox ran. ",
    null,
  );
  await window.__ewStores.app
    .getState()
    .openFileAt("Projects/Hollow Crown/manuscript/one.md");
});
await page.waitForTimeout(900);
await page.locator(".markdown-editor .cm-content").click();
await page.keyboard.press("Control+End");
for (const ch of ["@", "y", "u", "k", "i"]) {
  await page.keyboard.type(ch, { delay: 40 });
  await page.waitForTimeout(400);
  console.log(
    "after",
    JSON.stringify(ch),
    ":",
    await page.locator(".cm-tooltip-autocomplete").count(),
  );
}
await page.waitForTimeout(1500);
console.log(
  "autocomplete:",
  await page.locator(".cm-tooltip-autocomplete").count(),
  "| first option:",
  await page
    .locator(".cm-tooltip-autocomplete li")
    .first()
    .textContent()
    .catch(() => "(none)"),
);

await app.close();
await rm(sandbox, { recursive: true, force: true });
