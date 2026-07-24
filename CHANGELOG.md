# Changelog

All notable changes to Edenwright live here. Conventional-commit titles up top;
personality below. Rough edges are listed proudly, never hidden.

This is the real v0.1.0-beta line. (An engine-model prototype preceded it and
was composted — the garden doesn't ship prototypes.)

## [Unreleased] — 0.1.0-beta

### Changed

- **The welcome screen grew up into a launcher.** Obsidian-style home: brand pane on the left, "Your edens" (recents with preset icons, friendly dates, and a forget-me-not remove button that never touches files), an inline create flow with preset cards, and "Open an eden folder". The last eden auto-reopens on startup — the launcher is for first runs and switches. The eden switcher (current eden's name, chevron and all) moved to the title bar as the one canonical spot; the Files panel header stopped repeating it. Recents now remember preset/medium/last-opened and quietly prune folders that no longer exist.
- **One eden = one story.** The data model collapsed: the eden folder IS the project and the world. `eden.json` at the root, the preset scaffold beside it, one fixed `world/` for codex/notes/maps, `exports/` at the root. No more `Projects/`, `Worlds/`, or linked worlds — the Worlds rail, the new-project modal, and world linking went with them. Old edens migrate on open: a single-project eden collapses in place (manifests backed up under `.eden/migration-backup/`), a multi-project eden splits into one sibling eden per story and the original is kept, untouched, as `<name>-legacy`.
- **Goals, corkboard order, and exports follow the collapse.** Goals live in `eden.json` and count the whole eden; corkboard order saves to `eden.json`; exports land in the root `exports/`.
- **The Codex rail grew into the World tab.** One home for worldbuilding: entities up top with one-click create buttons per type (Character, Place, Item, Faction, Lore) and collapsible groups, shortcut rows to world notes & maps (with counts, and a make-the-first-one flow when empty), and a Story timeline row at the bottom. The designed empty state teaches what each entity type is for. Codex sheets, appearances, and `@`-mentions are untouched.

### Added

- **One unified writer for every kind of story** — novels, comics, screenplays, story-games, worldbuilding. Every medium shares one story skeleton: a tree of Markdown documents plus a codex, plain files you own forever.
- **Presets as data.** A medium is a preset — terminology ("Scene", "Page", "Episode"), structure, frontmatter defaults, creation scaffold. ~20 built-in presets across five media (prose, screenplay, comic, interactive, world); community presets need zero code.
- **The editor**: CodeMirror live preview, `[[wiki-links]]` + `@mentions`, smart typography, focus mode, quick switcher, global search, find & replace.
- **Codex & story views** — typed entity sheets with appearances; timeline, corkboard, goals & streaks, snapshot history with diffs and restore.
- **Universal exports built in** — manuscript Word, EPUB, PDF, clean Markdown, single-file HTML, Markdown zip, into the eden's gitignored `exports/`.
- **Community from day one** — theme system (built-in dark + Light & Quiet in the tab), a registry-backed community themes shelf with offline fallback, plugin dev docs, and the eight first-party plugins (screenplay mode, comic rail, story canvas, medium exporters, structure wizards, sprints, namesmith, stats) built in as core plugins.
- **The plain-files promise** — the index is a disposable cache; snapshots every 10 minutes; conflict copies never clobber; atomic writes; no accounts, no cloud, no telemetry.

### Polish (the founder's first-drive round)

- **The editor finally feels like writing.** Tab and Shift-Tab indent and outdent — never an escape hatch to the next control. Enter continues lists. Brackets pair, while quotes keep curling through smart typography instead of doubling. Scene breaks (`***`) sit centered.
- **@-completion works from the first letter.** A CodeMirror quirk (one-character queries only match a label's first character) used to kill the tooltip the moment you typed past `@` — the bug behind "the codex doesn't work." The codex panel also gained a filter, saner creation defaults (your current project, not the first world), live refresh, and an actual answer when there's nowhere to plant an entity yet.
- **Community installs work offline.** First-party theme seeds ship inside the app and install from the bundle — no release download required. (Plugin seeds went one better in R5: no install at all — they're core plugins, read straight from the bundle.)
- **It's an actual app now.** Help menu in the title bar (About, Check for Updates…, User guide, Report an issue, DevTools), an About dialog with the one sanctioned Lablooms-pink credit, a manual update check that always reports back, and preset icons that aren't all the same puzzle piece.

### The writer's toolkit (R4)

- **A formatting toolbar, no markdown degree required.** Bold, italic, strikethrough, three heading sizes, quote, both list flavors, and link — a slim bar above the editor with Lucide icons and tooltips that teach the hotkey. Every button toggles: press it again and the little codes come back off. The bar hides in focus mode, greys out on non-prose files, and politely steps aside whenever a plugin editor mode (screenplay, comic) owns the page — medium modes now tag their editor with `cm-ew-plugin-mode` so chrome knows to yield.
- **Hotkeys for the brave.** Ctrl/Cmd+B bold, Ctrl/Cmd+I italic, Ctrl/Cmd+K link (wraps the selection and pre-selects the `url` part so you type the address straight away), Ctrl/Cmd+1/2/3 for headings. They sit above CodeMirror's defaults and below plugin keys — screenplay's Tab-cycling is untouched.
- **An in-app Writing Guide.** Help menu → Writing guide: a shortcut cheat-sheet, and "How formatting works" in plain writer terms (your words are plain text files you own forever; the toolbar handles the little codes; `**` is just bold wearing its work clothes). The m-word is never spoken.
- **Spellcheck.** Electron's built-in checker, on by default, with a Settings → Editor toggle ("Check spelling while I write"). English dictionary for now; locale-following packs are a later bloom.
- **Typewriter scrolling.** Settings → Editor toggle keeps the line you're writing vertically centered, with room to scroll past the end of the document.
- **A document outline in the Details panel.** Headings of the open file, indented by depth, live as you type; a click scrolls the editor there. The empty state tells you how to make your first heading.
- **Comfort sliders.** Font size (14–22px) and line width (narrow → wide) sliders in Settings → Editor, applied live through `--ew-editor-font-size` and `--ew-editor-line-width` CSS vars.

### Core plugins round (R5)

- **Plugins split into Core and Installed, Obsidian-style.** Settings → Plugins opens on Core plugins: the eight first-party seeds with icons, plain-language descriptions, and a simple on/off toggle. They're built into the app — nothing to install, nothing to trust, nothing to uninstall, and the toggle applies live (screenplay mode flips the Courier page mid-edit). Installed plugins keeps the folder-installed list, "Install from folder…", the trust dialog, and restricted mode, exactly as before — with a designed empty state that promises community plugins after beta.
- **Community plugins are deferred to after beta.** The community plugin shelf, its registry fetch, and the third-party release-download install path are gone for now; the registry data and validator stay, ready for the return. Community THEMES are untouched. Privacy win: the app no longer fetches the plugin registry — the themes shelf and the update check are the only network calls left.
- **Core plugins default ON, per eden.** Turn off what you don't use (`coreDisabled` in settings); medium plugins no-op outside their medium, so "everything on" is calm by default. Restricted mode now honestly means "no third-party code": it silences folder-installed plugins while core plugins — ours — stay on.
- **Fixed a startup race the new defaults exposed.** `eden-opened` can fire before the renderer is listening (startup auto-reopen, bridge-driven creates), and the plugin runtime used to sync only off that event — so an eden learned about any other way ran plugin-free until settings changed. The runtime now syncs whenever the store learns an eden is open, and concurrent syncs collapse instead of double-loading.

### Final polish & first run (R6)

- **A welcome note in every new eden.** First-time writers open their fresh eden and find `welcome.md` at the root: a few warm lines in the preset's own words ("pages" for a manga, "scenes" for a novel) — what an eden is (a folder you own), where the writing lives, what the World tab holds, and a pointer to Help → Writing guide. It's stamped once, at creation, and never comes back if deleted. It also stays out of the index, so its words never inflate your daily goal.
- **Docs caught up with the app.** SPEC (v2.1, writer-first rework), the README, the user guide, and the decisions log now describe the one-story eden, the launcher, the World tab, the toolbar, and the core/installed plugin split — not the ghost of projects past.
- **The swallowed file-tree click is dead.** Clicking a folder row while the watcher refreshed the tree could eat the click; the culprit was out-of-order refresh responses flapping rows in and out, and refreshes are now latest-wins sequenced. Also in the pass: the outline's hover now uses the same ink wash as every other row, and installed-plugin rows line up with core-plugin rows in Settings.

### Rough edges we're shipping with (listed proudly)

- **A `-legacy` folder re-migrates if opened.** Multi-story legacy edens split into siblings and keep the original as `<name>-legacy`; that folder still looks pre-collapse, so opening it runs the migration again. Harmless — a backup of a backup — but odd.
- **Spellcheck is English-only for now.** Electron's hunspell follows the OS locale poorly; language packs need their own story first.
- **The toolbar judges file types by heuristics.** It greys out on files that don't look like prose and yields to any plugin editor mode; a file that IS prose but doesn't look it just keeps the bar quiet, never broken.
