# Changelog

All notable changes to Edenwright live here. Conventional-commit titles up top;
personality below. Rough edges are listed proudly, never hidden.

This is the real v0.1.0-beta line. (An engine-model prototype preceded it and
was composted — the garden doesn't ship prototypes.)

## [Unreleased] — 0.1.0-beta

### Added

- **One unified writer for every kind of story** — novels, comics, screenplays, story-games, worldbuilding. Every medium shares one story skeleton: a project is a tree of Markdown documents + codex + `project.json`, plain files you own forever.
- **Presets as data.** A medium is a preset — terminology ("Scene", "Page", "Episode"), structure, frontmatter defaults, creation scaffold. ~20 built-in presets across five media (prose, screenplay, comic, interactive, world); community presets need zero code.
- **The editor**: CodeMirror live preview, `[[wiki-links]]` + `@mentions`, smart typography, focus mode, quick switcher, global search, find & replace.
- **Codex & worlds** — typed entity sheets with appearances; shared canon linked across projects; timeline, corkboard, goals & streaks, snapshot history with diffs and restore.
- **Universal exports built in** — manuscript Word, EPUB, PDF, clean Markdown, single-file HTML, Markdown zip, into the project's gitignored `exports/`.
- **Community from day one** — theme system (built-in dark + Light & Quiet in the tab), registry-backed community tab with offline fallback, plugin dev docs, and optional medium plugins (screenplay mode, comic rail, story canvas, medium exporters) plus writing companions (structure wizards, sprints, namesmith, stats).
- **The plain-files promise** — the index is a disposable cache; snapshots every 10 minutes; conflict copies never clobber; atomic writes; no accounts, no cloud, no telemetry.

### Polish (the founder's first-drive round)

- **The editor finally feels like writing.** Tab and Shift-Tab indent and outdent — never an escape hatch to the next control. Enter continues lists. Brackets pair, while quotes keep curling through smart typography instead of doubling. Scene breaks (`***`) sit centered.
- **@-completion works from the first letter.** A CodeMirror quirk (one-character queries only match a label's first character) used to kill the tooltip the moment you typed past `@` — the bug behind "the codex doesn't work." The codex panel also gained a filter, saner creation defaults (your current project, not the first world), live refresh, and an actual answer when there's nowhere to plant an entity yet.
- **Community installs work offline.** First-party seeds (plugins and themes) ship inside the app and install from the bundle — no release download required; third-party entries still download, and there's an e2e to prove it.
- **It's an actual app now.** Help menu in the title bar (About, Check for Updates…, User guide, Report an issue, DevTools), an About dialog with the one sanctioned Lablooms-pink credit, a manual update check that always reports back, and preset icons that aren't all the same puzzle piece.
