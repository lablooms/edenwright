# Decisions — v2

Notable implementation choices, one line each. (Iteration-one decisions are archived with it.)

- **Orphan branch `v2` in a worktree** (`../edenwright-v2`) — main stays runnable for the founder while v2 is built; nothing pushes without their word.
- **`medium` is a free-form string tag, not an enum** — community media are first-class; built-ins ("prose", "screenplay", "comic", "interactive", "world") are documented, not enforced.
- **`project.json` stores `{ preset, medium }`** — medium denormalized at creation so joins (export dialog, medium plugins) never need the preset registry to read a project.
- **Universal export plumbing (docx/EPUB/PDF/HTML/md/zip) is built in; medium serializations are plugins** — the boundary is "format plumbing vs medium convention", and it keeps `docx`/`jszip` out of what community plugins must inline.
- **Plugin CM extensions take the old engine slot before `defaultKeymap`** — medium keymaps (screenplay Tab-cycling) keep their precedence; plugin typography rides CSS injection like the engines' style modules did.
- **Builtin presets seed the plugin-store (not a plugin)** — they're data; the store's `reset()` restores them, plugins only ever add.
- **`ScheduleSection` keys on `preset === "serial"`** — the v1 preset `features` map is gone; one honest check beats a speculative feature system.
- **No builtin plugins at all in v2** — the runtime's builtin machinery (trust-free, always-on) was deleted with the engines; the universal exporter registers straight into the store at startup.

## Polish round (founder's first drive)

- **Quote handling: brackets pair, quotes curl** — `closeBrackets()` fought smart typography (auto-paired straight quotes never curled); the pair list moved to markdown language data without quotes, so `(` pairs and `"` curls.
- **`indentWithTab` sits ABOVE plugin keymaps? No — below them, above defaultKeymap** — screenplay's Tab cycling keeps precedence in screenplay projects; prose gets indentation; nobody escapes the editor by accident.
- **Mention labels carry no `@` prefix** — CM's FuzzyMatcher only matches 1-char queries at a label's first character; the `@` moved to detail so `@y` completes from the first keystroke.
- **First-party seeds install from the app bundle** (`bundled` in registry entries, `app.readBundled` allow-listed to plugins/seed + themes, extraResources in the packager) — installs work offline today; release assets stay the update path for newer versions and third parties.
- **Remote and fixture registry lists merge bundled-first** — a stale or v1-era remote registry can never shadow the seeds the app carries.
- **`--ew-lablooms-pink` exists as a token, used exactly once** (About credit) — brand law kept: pink in credits, never an accent.

## One-story collapse (R1)

- **The eden folder IS the story** — `eden.json` at the root, preset scaffold beside it, one fixed `world/`; `Projects/`/`Worlds/` and linked worlds deleted outright rather than shimmed, because two layouts would haunt every future feature.
- **Legacy edens migrate on open, backup first** — manifests copied to `.eden/migration-backup/` before anything moves; a multi-story eden splits into sibling edens and the original is kept untouched as `<name>-legacy`. Known quirk: a `-legacy` folder still looks pre-collapse, so opening it migrates it again — documented, harmless.

## World tab (R3)

- **The World tab replaced the Codex rail instead of adding a second home** — one canonical place for worldbuilding (entities, world notes/maps shortcuts, timeline entry); codex sheets, appearances, and `@`-mentions run underneath unchanged.

## Launcher round (R2)

- **Auto-reopen lives in the main process, decided by `recents.list()[0]`** — the renderer never guesses; a failed open just leaves the launcher up, and lazy pruning means a dead folder never gets offered.
- **Recents carry `preset`/`medium`/`lastOpenedAt` (ISO), all optional** — pre-R2 entries (path+name, legacy `lastOpenedAtMs`) normalize on read instead of needing a migration.
- **The eden switcher is a `TitleBar` slot, styled in the renderer** — `packages/ui` gained one optional prop; the button itself (name + chevron → `eden.close()`) is app chrome, not design-system law. The Files panel's old eden header went away so the name appears exactly once.

## Writer toolkit round (R4)

- **Plugin editor modes yield chrome via a DOM marker class, `cm-ew-plugin-mode`** — the toolbar hides with one CSS `:has()` rule instead of a renderer-side mode registry; documented in plugin-api as the convention for medium plugins.
- **Comfort settings ride CSS vars on `.markdown-editor`** (`--ew-editor-font-size`, `--ew-editor-line-width`) — sliders restyle without a CodeMirror reconfigure; only the font family still goes through a CM compartment.
- **Spellcheck language is fixed en-US** — Electron's hunspell dictionaries follow the OS locale poorly; a language picker needs a dictionary-pack story first (comment in `main/index.ts`).

## Core plugins round (R5)

- **Community plugins UI deferred to post-beta** — the plugins shelf, the plugin registry fetch, and the release-download install path were deleted (registry JSON + `validate.mjs` kept for the return); community THEMES keep their shelf untouched (`themes-registry.ts`, `ThemesCommunitySection`).
- **Core plugins default ON; `settings.plugins.coreDisabled: string[]` holds the opt-outs** — absence means enabled, so pre-R5 settings files turn every seed on with no migration; medium plugins self-gate by medium, so all-on is a no-op outside their medium.
- **Core plugins load straight from the bundle** (`app.readBundled("plugins/seed/<dir>/…")`, dir list in `plugins/core-plugins.ts`) — no copy into `.eden/plugins/`, no trust prompt, no uninstall; they run through the same evaluation path as folder plugins, so the "no builtin plugins" line above still stands: privilege is in the source, not the runtime.
- **Restricted mode means "no third-party code"** — it silences folder-installed plugins only; core plugins are first-party and exempt.
- **The runtime syncs on eden identity, not just the `eden-opened` event** — the event can fire before the renderer subscribes (startup auto-reopen, bridge creates); an App effect on the open eden's path re-syncs, and `syncFromSettings` collapses concurrent calls instead of double-loading.

## First-run & polish round (R6)

- **The welcome note is stamped by core `createEden`, once** — one seam every creation path flows through (launcher, bridge, tests); it's flavored from the builtin preset's terminology with a generic fallback for community presets, and nothing re-creates it after deletion.
- **`welcome.md` is excluded from the index** (filter in core `rebuildIndex`, incremental guard in the shell's `isContentPath`) — it's orientation, not writing: its words must never count toward the writer's goals, and search stays about their own work. It still lists in the file tree, which reads the disk, not the index.
- **Tree refreshes are latest-wins sequenced** (a monotonic guard in `refreshTree`, bumped on close too) — the "swallowed click" was layout flap from out-of-order IPC refresh responses, not row remounts (keys were always stable); stale responses now land nowhere.
- **Hover language unified on `--ew-surface-hover`** — the outline section hovered with `--ew-surface-raised` (the solid panel color), the one straggler against every other interactive row; installed-plugin rows gained the same leading `Puzzle` glyph as core rows so the two subtabs align.
- **No danger token, no improvised fix** — the launcher's open-error treatment and the warn toast disagree, but canonical error styling is a design decision (needs a token), so it was flagged for the founder, not guessed.
