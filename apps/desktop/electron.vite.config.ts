import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const here = dirname(fileURLToPath(import.meta.url));

// Bundle workspace packages straight from source: `pnpm dev` and
// `pnpm package` never depend on a prior `dist` build of the libraries.
// Exact-match regexes — string aliases prefix-match and would break
// subpath imports like "@edenwright/ui/styles/tokens.css".
const sourceAliases = [
  {
    find: /^@edenwright\/core$/,
    replacement: resolve(here, "../../packages/core/src/index.ts"),
  },
  {
    find: /^@edenwright\/plugin-api$/,
    replacement: resolve(here, "../../packages/plugin-api/src/index.ts"),
  },
  {
    find: /^@edenwright\/ui$/,
    replacement: resolve(here, "../../packages/ui/src/index.ts"),
  },
  {
    find: /^@edenwright\/exporters$/,
    replacement: resolve(here, "../../packages/exporters/src/index.ts"),
  },
];

export default defineConfig({
  main: {
    // Exclude workspace packages from externalization or the plugin marks
    // them external before the alias applies — and the bundle silently
    // resolves a stale dist at runtime instead of fresh sources.
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          "@edenwright/core",
          "@edenwright/plugin-api",
          "@edenwright/ui",
        ],
      }),
    ],
    resolve: {
      alias: sourceAliases,
    },
    build: {
      outDir: "out/main",
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: sourceAliases,
    },
    build: {
      outDir: "out/renderer",
    },
  },
});
