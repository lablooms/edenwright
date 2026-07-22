/**
 * Renders the placeholder bloom icon (packages/ui/src/assets/bloom-icon.svg)
 * into the electron-builder icon set in apps/desktop/build/:
 *   icon.png (1024) — Linux + window icon
 *   icon.ico        — Windows
 *   icon.icns       — macOS
 * The founder swaps the SVG; this script and the geometry stay.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BILINEAR, createICNS, createICO } from "png2icons";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const svgPath = require.resolve("@edenwright/ui/assets/bloom-icon.svg");
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "build");

await mkdir(outDir, { recursive: true });

const png = await sharp(svgPath, { density: 384 })
  .resize(1024, 1024)
  .png()
  .toBuffer();
await writeFile(join(outDir, "icon.png"), png);

// electron-builder can auto-convert a 1024 png, but explicit ico/icns keeps
// packaging deterministic across the three CI runners.
try {
  const ico = createICO(png, BILINEAR, 256, false, true);
  if (ico) await writeFile(join(outDir, "icon.ico"), ico);
  const icns = createICNS(png, BILINEAR, 0);
  if (icns) await writeFile(join(outDir, "icon.icns"), icns);
} catch (error) {
  console.warn("png2icons failed; electron-builder will auto-convert:", error);
}

console.log(`Icons written to ${outDir}`);
