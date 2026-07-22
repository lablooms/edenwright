# Edenwright user guide

Welcome to the garden. This guide walks the whole app in the order you'll
meet it.

## Edens

An **eden** is a plain folder holding everything: `Projects/`, `Worlds/`,
and a `.eden/` folder of settings, snapshots, plugins, and themes. Create
one from the welcome screen; recent edens wait there too. Because an eden is
just files, you can move it, back it up, or sync it with anything that syncs
folders.

Inside `.eden/` you'll find `index.db` — a cache. Delete it; lose nothing.
It rebuilds from your files every time the eden opens.

## Projects & presets

A project is a work of one kind — and "kind" is just data. **New project**
shows ~20 presets grouped by medium:

- **Prose** — novels, novellas, collections, serials, light novels, memoir
- **Screenplay** — feature film, TV, stage, animation, audio drama
- **Comic** — manga, western, webtoon, picture book
- **Interactive** — visual novels, game narrative, interactive fiction,
  TTRPG campaigns
- **World** — worldbuilding and series bibles (these live in `Worlds/`)

Every project shares one skeleton: a tree of Markdown documents, a codex,
and `project.json`. The preset decides what your documents are called
("Scene", "Page", "Episode"), what folders appear, and which frontmatter
fields get stamped. Medium-specific _powers_ — screenplay formatting, comic
panel rails, a story canvas, Fountain/Ren'Py exports — are optional plugins
from the community tab, installed per taste.

## The editor

Markdown with live preview: bold looks bold, headings loom, syntax marks
appear only where your cursor works.

- `[[wiki-links]]` — type `[[` to complete any file title;
  Ctrl/Cmd-click to open. Rename a file and its links follow.
- `@mentions` — `@` completes codex entities (and linked worlds' entities,
  badged with the world's name).
- **Smart typography** — quotes curl, `--` becomes an em-dash (Settings →
  Editor).
- **Focus mode** — Ctrl/Cmd-Shift-Enter fades the chrome; Esc returns.
- `%%inline comments%%` render as quiet annotations and never export.
- Screenplay projects get Courier Prime, element cycling with Tab, and
  industry indents. Comic projects get PAGE/PANEL structure with a page-flow
  rail.

## Codex & worlds

The **codex** is your entity layer: characters, locations, items, factions,
concepts — typed sheets with aliases, custom fields, and notes. The Codex
panel browses them; clicking a mention opens its sheet; every sheet lists
its **appearances** across your files.

**Worlds** are shared canon. Link a world to any project from the Details
panel, and its entities join that project's `@`-completion and searches.
Promote a project entity into a world in one click. The Worlds panel lists
every world, its entity count, and who links it.

## Story tools

- **Timeline** — story dates on one track (drag to change), narrative order
  on another, amber flags when an entity is in two places on the same day.
- **Corkboard** — your project as index cards: title, synopsis, status.
  Drag to reorder; the order persists in `project.json`.
- **Goals & streaks** — project target and daily goal with progress bars, a
  streak calendar, and a 14-day chart in the Details panel.
- **History** — every snapshot holding a version of the open file, an
  inline diff, one-click restore. Restoring snapshots the present first.

## Exports

The download icon in the editor header (or "Export project…" in the
palette) opens the export dialog. Files land in the project's gitignored
`exports/` folder.

**Every project** gets the universal formats: manuscript Word, EPUB, PDF,
clean Markdown, single-file HTML, and a Markdown zip bundle. Install the
**Medium Exporters** plugin and your medium's serializations join the same
dialog: industry screenplay PDF, Fountain, Final Draft FDX, comic script
PDF, Ren'Py skeleton, Twee, outline PDF, and a graph JSON dump.

## Plugins & themes

**Settings → Plugins** has two halves: what's installed, and the community
tab — browse, search, install, update. First enable of any plugin shows one
blunt dialog: plugins run with the app's full access; install only what you
trust. **Restricted mode** silences all community plugins.

**Themes** live on their own rail panel: apply, remove, and install from
the community tab. The built-in dark theme is always there; two seed themes
(light and quiet) ship in the tab.

Make your own: [docs/plugins/](plugins/README.md) — a plugin is two files
and an afternoon.

## Data safety

- **Atomic writes** — every save is temp-file-then-rename.
- **Snapshots** — changed files zip into `.eden/snapshots/` every 10
  minutes and at session end (configurable, Settings → Snapshots).
- **Conflict copies** — if a file changed on disk since you read it, your
  save lands beside it as a conflicted copy. Never a clobbered word.
- **Git-friendly** — edens diff cleanly; `exports/` is gitignored by
  template.

## Keyboard

| Keys                 | Action                                    |
| -------------------- | ----------------------------------------- |
| Ctrl/Cmd-P           | Quick switcher: files, entities, commands |
| Ctrl/Cmd-Shift-F     | Global search                             |
| Ctrl/Cmd-S           | Save                                      |
| Ctrl/Cmd-Shift-Enter | Focus mode                                |
| Ctrl/Cmd-click       | Open a link or mention                    |

## Updates & privacy

On start, Edenwright checks GitHub for a newer release and tells you —
that's the whole conversation. No telemetry, no analytics, no accounts. The
community tab's registry fetch and the update check are the only network
calls, and both fail silently offline.
