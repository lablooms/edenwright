# Getting started with Edenwright plugins

A plugin is a folder with two files:

```
my-plugin/
  manifest.json
  main.js
```

That's the whole contract. No build step is required — `main.js` is plain
CommonJS, evaluated by the app with a small import allow-list:

- `@edenwright/plugin-api` — the typed API
- `./manifest.json` — your own manifest
- `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`,
  `@codemirror/language`, `@codemirror/search` — the app's own CodeMirror
  instances, for editor extensions (a second copy would break class
  identity, so the app shares its own)

Everything else you need gets inlined into `main.js`.

## 1. Copy the sample

`sample-plugin/` in the repo root is the commented starting point ("Hello,
eden"). Copy it into your eden's `.eden/plugins/` folder, rename the `id` in
`manifest.json`, and it appears under **Settings → Plugins**.

## 2. The manifest

```json
{
  "id": "you.my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "minAppVersion": "0.1.0-beta",
  "description": "One honest sentence about what it does.",
  "author": "Your Name",
  "authorUrl": "https://example.com",
  "fundingUrl": "https://example.com/sponsor"
}
```

`id` is reverse-domain kebab (`you.my-plugin`). `minAppVersion` is checked
at load.

## 3. The plugin

```js
const { definePlugin } = require("@edenwright/plugin-api");

module.exports = definePlugin({
  manifest: require("./manifest.json"),
  onload(ctx) {
    ctx.commands.register({
      id: "my-plugin:hello",
      name: "Say hello",
      callback: () => ctx.notices.show("Hello."),
    });
  },
});
```

`ctx` is the entire API (see [API reference](api/README.md)). Everything you
register returns a `Disposable`, and the runtime disposes all of it when your
plugin is disabled — you register, the runtime cleans up.

## 4. What you can build

- **Commands** — palette entries (`ctx.commands`).
- **Views & panels** — vanilla DOM, hosted in the side panel, opened from
  ribbon items (`ctx.workspace`).
- **Editor extensions** — real CodeMirror 6 extensions; register a factory
  `(context) => Extension | null` and gate by the document's `medium` /
  `preset` — that's how medium modes work (`ctx.editor`).
- **Settings tabs** — your own page in the settings window (`ctx.settings`).
- **Entity types** — new codex types (`ctx.entities`).
- **Exporters** — new export formats; tag them with `media: [...]` so they
  appear for matching projects (`ctx.exporters`).
- **Presets** — new media as pure data: terminology, structure, defaults,
  scaffold. Zero code, whole new kind of story (`ctx.presets`).
- **File events, index reads, toasts & modals** (`ctx.events`, `ctx.index`,
  `ctx.notices`).
- **File access** — read and write inside the eden via `ctx.eden.fs`. There
  is no API for paths outside the eden.

## 5. Writing in TypeScript

Author against `@edenwright/plugin-api` for full types, then compile to a
single CommonJS `main.js` (any bundler; only the allow-listed modules may be
imported at runtime — bundle everything else in). Ship `manifest.json` +
`main.js` (+ optional `styles.css`).

## 6. Styling

Your `styles.css` loads with your plugin. Use the app's CSS custom properties
(`--ew-leaf`, `--ew-ink`, `--ew-surface-raised`, …) so community themes repaint
your UI too. Editor modes: add a scope class to your editor and dress only it
— plugin styles are global, and prose should stay in its own font.

## 7. Shipping it

Publish a GitHub release on your repo with `manifest.json`, `main.js`, and
`styles.css` as release assets, then PR the
[registry](https://github.com/lablooms/edenwright-registry) — see
[review guidelines](review-guidelines.md).
