/**
 * tsc emits JS but does not copy the components' CSS. Vite resolves the CSS
 * imports relative to the emitted JS, so mirror every .css from src/ to dist/.
 */
import { cpSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function copyCss(from, to) {
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const target = join(to, entry);
    if (statSync(source).isDirectory()) {
      copyCss(source, target);
    } else if (entry.endsWith(".css")) {
      cpSync(source, target, { recursive: true });
    }
  }
}

copyCss(join(root, "src"), join(root, "dist"));
