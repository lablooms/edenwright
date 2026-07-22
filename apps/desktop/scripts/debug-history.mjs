import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "@playwright/test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = await mkdtemp(join(tmpdir(), "edenwright-dbgh-"));
let app;
try {
  app = await electron.launch({
    args: ["."],
    cwd: appRoot,
    env: { ...process.env, EDENWRIGHT_TEST: "1" },
  });
  const page = await app.firstWindow();
  await page.evaluate(
    (p) => window.edenwright.eden.create(p, "Dbg Eden"),
    sandbox.replace(/\\/g, "/"),
  );
  await page.evaluate(() => window.edenwright.test.whenRebuilt());
  await page.evaluate(async () => {
    await window.edenwright.projects.create({
      name: "Hollow Crown",
      engine: "edenwright.engine.prose",
      preset: "novel",
    });
  });
  const rel = "Projects/Hollow Crown/manuscript/scene one.md";
  await page.evaluate(
    ([path, text]) => window.edenwright.files.write(path, text, null),
    [rel, "version one\n"],
  );
  console.log(
    "snap 1:",
    await page.evaluate(() => window.edenwright.test.snapshotNow()),
  );
  await page.evaluate(
    async ([path, text]) => {
      const file = await window.edenwright.files.read(path);
      await window.edenwright.files.write(path, text, file.mtimeMs);
    },
    [rel, "version two\n"],
  );

  const versions = await page.evaluate(
    (path) => window.edenwright.history.versions(path),
    rel,
  );
  console.log(
    "versions before restore:",
    versions.map((v) => v.name),
  );
  console.log(
    "probe snapshotNow before restore:",
    await page.evaluate(() => window.edenwright.test.snapshotNow()),
  );

  const snapName = versions[0].name;
  const result = await page.evaluate(
    ([name, path]) => window.edenwright.history.restore(name, path),
    [snapName, rel],
  );
  console.log("restore result:", JSON.stringify(result));

  const after = await page.evaluate(
    (path) => window.edenwright.history.versions(path),
    rel,
  );
  console.log(
    "versions after restore:",
    after.map((v) => v.name),
  );
  console.log(
    "snapshots dir:",
    await readdir(join(sandbox, "Dbg Eden", ".eden", "snapshots")),
  );
  console.log("disk:", await readFile(join(sandbox, "Dbg Eden", rel), "utf8"));
} finally {
  await app?.close();
  await rm(sandbox, { recursive: true, force: true });
}
