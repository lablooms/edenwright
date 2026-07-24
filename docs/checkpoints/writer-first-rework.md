# Writer-first rework — checkpoint (R1–R6)

**The rework:** six rounds that turned v2 from "a studio for projects" into "a studio for writers." One eden = one story, an Obsidian-style first-run, a World tab instead of a codex rail, a formatting toolbar that never says the m-word, plugins split into core and installed — and a final polish pass to make it all feel like one app.

## What was built

1. **One eden = one story (R1).** The data model collapsed: the eden folder IS the story. `eden.json` at the root, preset scaffold beside it, one fixed `world/` (`codex/`, `notes/`, `maps/`), `exports/` at the root, `.eden/` for the machine. `Projects/`, `Worlds/`, `project.json`, `world.json`, and linked worlds are gone. Legacy edens migrate on open: single-story collapses in place (manifests backed up under `.eden/migration-backup/`), multi-story splits into sibling edens with the original kept untouched as `<name>-legacy`.
2. **Launcher & switching (R2).** Obsidian-style home: brand pane, "Your edens" recents (preset icons, friendly dates, forget-me-not remove), inline create flow with preset cards, open-folder. Eden switcher in the title bar; last eden auto-reopens on startup.
3. **World tab (R3).** The Codex rail grew into the World tab: one-click entity creation (Character/Place/Item/Faction/Lore), a designed empty state that teaches the types, world notes & maps shortcuts with counts, and a Story timeline row. The Worlds panel went away.
4. **Writer's toolkit (R4).** Formatting toolbar (B/I/S/H1–H3/quote/lists/link, hotkey-labeled tooltips, hides in focus mode and plugin editor modes via `cm-ew-plugin-mode`), hotkeys (Ctrl/Cmd+B/I/K/1/2/3), in-app Writing Guide, spellcheck (default ON, en-US), typewriter mode, document outline in the Details panel, font-size/line-width comfort sliders (`editor.lineWidth`, `editor.spellcheck`, `editor.typewriterMode`).
5. **Core plugins (R5).** Settings → Plugins split: **Core plugins** (the eight first-party seeds, default ON, loaded from the bundle, no trust dialog; opt-outs in `settings.plugins.coreDisabled`) and **Installed plugins** (folder installs, trust dialog, restricted mode — now "no third-party code", core exempt). The community-plugins UI and its registry fetch were removed (deferred post-beta; `registry/` + `pnpm test:registry` kept for the return). Community THEMES keep their shelf.
6. **Polish & first run (R6).** A preset-flavored `welcome.md` stamped once at eden creation (never re-created, excluded from the index so its words never count toward goals); a designed-states polish pass across launcher, panels, and settings; docs alignment (SPEC v2.1, user guide, decisions, changelog); this checkpoint.

## How to run it

- `pnpm install` then `pnpm dev` — the app opens on the launcher (first run) or reopens your last eden.
- `pnpm package` — electron-builder for the current OS; the packaged app carries the bundled core plugins and theme seeds.

## Verified

- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` (141 unit), `pnpm test:registry`, `pnpm build` — green.
- e2e: **57 specs green** (`pnpm test:e2e`), including the R6 first-run welcome-note spec and the tree-click regression now clicking like a person.
- Packaged Windows build: `pnpm package` green (NSIS + portable), and `scripts/verify-packaged.mjs` — repaired from its pre-R1 `Projects/hello.md` days — confirms the packaged app launches, writes, indexes (native sqlite OK), and carries the bundled seeds.

## Honest gaps

- **A `-legacy` folder re-migrates if opened.** The split keeps the original multi-story eden as `<name>-legacy`, which still looks pre-collapse — opening it runs the migration again. Harmless (a backup of a backup), documented in SPEC §9.
- **Spellcheck is English-only.** Electron's hunspell follows the OS locale poorly; a language-picker needs a dictionary-pack story first.
- **Toolbar file-type heuristics.** The bar greys out on files that don't look like prose and yields to plugin editor modes; conservative by design, never destructive.
- **No danger token yet.** The launcher's inline open-error and the warn toast style errors differently; canonical error styling needs a design decision (a token), so it was flagged, not improvised.
- ~~File-tree clicks swallowed during watcher refreshes~~ — fixed in R6: refreshes are latest-wins sequenced, and the e2e that used to toggle expansion through the store now clicks the row like a person.
