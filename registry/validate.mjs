#!/usr/bin/env node
/**
 * Registry validator (SPEC §9.4). Submission = PR; this script is the
 * automated half of review: schema, unique ids, required fields, shape of
 * repo/version/URLs. Runs in CI on every change to registry/. No deps.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const ID_RE = /^[a-z0-9][a-z0-9.-]*$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const VERSION_RE = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i;

let failures = 0;
const fail = (file, index, message) => {
  failures += 1;
  console.error(`✗ ${file} entry ${index}: ${message}`);
};

async function validateFile(file, kind) {
  const path = join(here, file);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(file, "-", `not valid JSON (${error.message})`);
    return;
  }
  if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    fail(file, "-", 'expected { "version": 1, "entries": [...] }');
    return;
  }

  const seen = new Set();
  parsed.entries.forEach((entry, index) => {
    const where = `${file} entry ${index} (${entry?.id ?? "?"})`;
    if (typeof entry?.id !== "string" || !ID_RE.test(entry.id)) {
      fail(
        file,
        index,
        "id must be kebab-case (dots allowed for reverse-domain)",
      );
    }
    if (seen.has(entry.id)) fail(file, index, `duplicate id "${entry.id}"`);
    seen.add(entry.id);
    for (const field of ["name", "version", "description", "author"]) {
      if (typeof entry[field] !== "string" || entry[field].length === 0) {
        fail(file, index, `${field} is required`);
      }
    }
    if (typeof entry.version === "string" && !VERSION_RE.test(entry.version)) {
      fail(file, index, `version "${entry.version}" is not semver-ish`);
    }
    if (typeof entry.repo !== "string" || !REPO_RE.test(entry.repo)) {
      fail(file, index, "repo must look like owner/name");
    }
    if (typeof entry.releaseTag !== "string" || entry.releaseTag.length === 0) {
      fail(file, index, "releaseTag is required (release assets ship there)");
    }
    if (entry.bundled !== undefined) {
      // First-party seeds ship inside the app; bundled installs work offline.
      if (
        typeof entry.bundled !== "string" ||
        !/^(plugins\/seed|themes)\/[a-z0-9-]+$/.test(entry.bundled)
      ) {
        fail(file, index, "bundled must be plugins/seed/<id> or themes/<id>");
      } else if (
        // The existence check only applies in the main repo (the seeds live
        // beside registry/ there); in the registry repo, shape is enough.
        existsSync(join(here, "..", "plugins", "seed")) &&
        !existsSync(join(here, "..", entry.bundled, "manifest.json"))
      ) {
        fail(file, index, `bundled path ${entry.bundled} has no manifest.json`);
      }
    }
    if (entry.screenshots !== undefined) {
      if (
        !Array.isArray(entry.screenshots) ||
        entry.screenshots.some(
          (url) => typeof url !== "string" || !url.startsWith("https://"),
        )
      ) {
        fail(file, index, "screenshots must be https URLs");
      }
    }
    if (kind === "theme" && entry.id === "edenwright-dark") {
      console.log(`! ${where}: note — the default theme is not uninstallable`);
    }
  });
  console.log(
    `✓ ${file}: ${parsed.entries.length} ${kind} entr${parsed.entries.length === 1 ? "y" : "ies"} valid`,
  );
}

await validateFile("community-plugins.json", "plugin");
await validateFile("community-themes.json", "theme");

if (failures > 0) {
  console.error(`\n${failures} registry problem(s) found.`);
  process.exit(1);
}
console.log("Registry valid.");
