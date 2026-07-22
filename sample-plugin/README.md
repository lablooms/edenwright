# Hello, eden — the sample Edenwright plugin

Copy this folder to start your own plugin. It adds:

- a **command** ("Say hello to the eden") to the palette,
- a **panel** (vanilla view) with a styled greeting,
- a **ribbon item** that opens the panel.

## Try it

1. Open an eden in Edenwright.
2. Settings → Plugins → **Install from folder…** and pick this folder
   (or copy it into `<your eden>/.eden/plugins/lablooms.hello-eden/` yourself).
3. Enable it, accept the trust dialog, and click the sprout in the sidebar.

## Anatomy (SPEC §9.1)

```
manifest.json   id, name, version, minAppVersion, description, author
main.js         CommonJS; the only allowed import is @edenwright/plugin-api
styles.css      optional; injected while your plugin is enabled
```

Everything a plugin registers returns a `Disposable`; the runtime disposes
all of it on unload. Plugin authors write TypeScript against
`@edenwright/plugin-api` (MIT) and compile to a single `main.js` —
this sample stays plain JS so it runs with zero build steps.

## Rules of the garden

- Plugins run with real capability — the API gives you the eden's files,
  index, editor, and workspace. Be a good neighbor.
- Only the Edenwright CSS custom properties (`--ew-*`) in styles.
- No network, no telemetry. Golden rule 6 applies to you too.
