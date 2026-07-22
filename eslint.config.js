import { builtinModules } from "node:module";

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const nodeBuiltinNames = builtinModules.map((name) =>
  name.startsWith("node:") ? name : `node:${name}`,
);

/** Packages bound by the Portable Core Law (SPEC v2 §3.3). */
const PORTABLE_PACKAGES = [
  "packages/core/**/*.ts",
  "packages/plugin-api/**/*.ts",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/release/**",
      "**/coverage/**",
      "**/build/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Dev scripts that drive a browser/renderer page (playwright evaluate).
    files: ["apps/desktop/scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // Plugins are CommonJS by design (SPEC §9.1) — the runtime evaluates
    // them with a require shim, so require() is the correct form here. They
    // run in the renderer, so browser globals are their environment.
    files: ["sample-plugin/**/*.js", "plugins/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // The Portable Core Law: core, plugin-api, and engines must stay free of
    // Electron, Node built-ins, and DOM storage so a future shell (mobile,
    // web) is an adapter swap instead of a rewrite. Fails CI by design.
    files: [...PORTABLE_PACKAGES],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "electron",
              message:
                "Portable Core Law (SPEC §5.3): platform capabilities go through core adapter interfaces, implemented in apps/desktop.",
            },
          ],
          patterns: [
            {
              group: ["electron/*"],
              message:
                "Portable Core Law (SPEC §5.3): no Electron imports in portable packages.",
            },
            {
              group: ["node:*", ...nodeBuiltinNames],
              message:
                "Portable Core Law (SPEC §5.3): no Node built-ins in portable packages.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message:
            "Portable Core Law (SPEC §5.3): no DOM storage in portable packages.",
        },
        {
          name: "sessionStorage",
          message:
            "Portable Core Law (SPEC §5.3): no DOM storage in portable packages.",
        },
        {
          name: "indexedDB",
          message:
            "Portable Core Law (SPEC §5.3): no DOM storage in portable packages.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "localStorage",
          message:
            "Portable Core Law (SPEC §5.3): no DOM storage in portable packages.",
        },
        {
          object: "window",
          property: "sessionStorage",
          message:
            "Portable Core Law (SPEC §5.3): no DOM storage in portable packages.",
        },
        {
          object: "window",
          property: "indexedDB",
          message:
            "Portable Core Law (SPEC §5.3): no DOM storage in portable packages.",
        },
      ],
    },
  },
);
