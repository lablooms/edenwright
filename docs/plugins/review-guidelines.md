# Plugin review guidelines

Community listing is trust + review, Obsidian-style: automated checks first,
human review second, and a blunt one-time trust dialog before any plugin runs
on a user's eden.

## What the registry CI checks

`node validate.mjs` validates every entry:

- unique reverse-domain kebab `id` (`you.my-plugin`)
- `name`, `version`, `description`, `author` present
- semver-ish `version`
- `repo` in `owner/name` form, plus a `releaseTag` where the assets live
- screenshot URLs are https

## What a reviewer checks by hand

1. **Open source.** The plugin's repo must be public with source matching the
   shipped `main.js`. Minified bundles without source are declined.
2. **License.** MIT (or compatible) — same spirit as the app.
3. **Data safety.** A plugin must never delete or overwrite user files without
   an explicit user action. Never a clobbered word.
4. **Imports.** Only the allow-list (`@edenwright/plugin-api`, `@codemirror/*`,
   own manifest). Everything else is inlined — if a plugin needs a library
   badly enough to matter, that's an API conversation, not a workaround.
5. **Network.** No network calls except the user's explicit actions. No
   telemetry, ever.
6. **Scope.** Reads/writes stay inside the eden via `ctx.eden.fs`.
7. **Honesty.** The description says what the plugin does today.

## Versioning & updates

- Bump `version` for every release; the community tab shows Update when the
  registry entry is newer than the install.
- Keep `minAppVersion` honest — new API surface means a new floor.
- Breaking a user's data is an immediate delisting.

## Registry entry format

```json
{
  "id": "you.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "One honest sentence.",
  "author": "Your Name",
  "repo": "you/my-plugin",
  "releaseTag": "v1.0.0",
  "screenshots": ["https://…/screenshot.png"]
}
```

Release assets expected at that tag: `manifest.json`, `main.js`, and
optionally `styles.css`. Themes ship `manifest.json` + `theme.css` and are
listed in `community-themes.json` instead.
