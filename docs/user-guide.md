# Edenwright user guide

Welcome to the garden. This guide walks the whole app in the order you'll
meet it.

## Edens

An **eden** is a plain folder that IS your story: `eden.json` (the eden's
memory of itself), your writing in preset-made folders right at the top, one
`world/` folder for your world's codex, notes, and maps, an `exports/`
folder, and a `.eden/` folder of settings, snapshots, plugins, and themes.
One eden, one story — writing three novels means three edens.

The app opens on the **launcher**: your recent edens on one side, and a
create flow with preset cards on the other. The last eden reopens by itself
next time, and the eden switcher in the title bar hops between edens. A
brand-new eden greets you with a short `welcome.md` at its root — read it,
keep it, or delete it; it won't come back. Because an eden is just files,
you can move it, back it up, or sync it with anything that syncs folders.

Inside `.eden/` you'll find `index.db` — a cache. Delete it; lose nothing.
It rebuilds from your files every time the eden opens.

(Made an eden with a very early Edenwright? It upgrades itself on first
open, keeping a backup under `.eden/migration-backup/`.)

## Stories & presets

A story is a work of one kind — and "kind" is just data. Creating an eden
shows ~20 presets grouped by medium:

- **Prose** — novels, novellas, collections, serials, light novels, memoir
- **Screenplay** — feature film, TV, stage, animation, audio drama
- **Comic** — manga, western, webtoon, picture book
- **Interactive** — visual novels, game narrative, interactive fiction,
  TTRPG campaigns
- **World** — worldbuilding and series bibles

Every story shares one skeleton: a tree of documents in plain text files,
plus the codex in `world/`. The preset decides what your documents are
called ("Scene", "Page", "Episode"), what folders appear, and which fields
get stamped into new files. Medium-specific _powers_ — screenplay
formatting, comic panel rails, a story canvas, Fountain/Ren'Py exports —
are built in as **core plugins**, on by default, waiting quietly until your
story's medium calls for them (Settings → Plugins).

## The editor

Your words are plain text with live preview: bold looks bold, headings loom,
and the little codes behind them appear only where your cursor works. No
codes to learn, though — the **formatting toolbar** above the editor handles
bold, italic, strikethrough, three heading sizes, quotes, lists, and links,
and every tooltip teaches its hotkey. **Help → Writing guide** explains it
all in plain terms.

- `[[wiki-links]]` — type `[[` to complete any file title;
  Ctrl/Cmd-click to open. Rename a file and its links follow.
- `@mentions` — `@` completes your world's people, places, and things.
- **Spellcheck** — on by default (English); toggle in Settings → Editor.
- **Typewriter mode** — keeps the line you're writing centered (Settings →
  Editor).
- **Smart typography** — quotes curl, `--` becomes an em-dash (Settings →
  Editor).
- **Comfort sliders** — font size and line width, in Settings → Editor.
- **Focus mode** — Ctrl/Cmd-Shift-Enter fades the chrome; Esc returns.
- **Outline** — the Details panel lists the open file's headings; a click
  jumps there.
- `%%inline comments%%` render as quiet annotations and never export.
- Screenplay stories get Courier Prime, element cycling with Tab, and
  industry indents. Comic stories get PAGE/PANEL structure with a page-flow
  rail.

## The World tab

The **World** tab is your world's home. Create characters, places, items,
factions, and lore with one click each; every entity is a typed sheet with
aliases, custom fields, and notes. Clicking an `@`-mention opens its sheet,
and every sheet lists its **appearances** across your files. Shortcut rows
lead to your world notes and maps, and a Story timeline row sits at the
bottom.

## Story tools

- **Timeline** — story dates on one track (drag to change), narrative order
  on another, amber flags when an entity is in two places on the same day.
- **Corkboard** — your story as index cards: title, synopsis, status.
  Drag to reorder; the order persists in `eden.json`.
- **Goals & streaks** — a word target and daily goal with progress bars, a
  streak calendar, and a 14-day chart in the Details panel.
- **History** — every snapshot holding a version of the open file, an
  inline diff, one-click restore. Restoring snapshots the present first.

## Exports

The download icon in the editor header (or "Export…" in the palette) opens
the export dialog. Files land in the eden's gitignored `exports/` folder.

**Every story** gets the universal formats: manuscript Word, EPUB, PDF,
clean Markdown, single-file HTML, and a Markdown zip bundle. The **Medium
Exporters** core plugin (on by default) adds your medium's serializations to
the same dialog: industry screenplay PDF, Fountain, Final Draft FDX, comic
script PDF, Ren'Py skeleton, Twee, outline PDF, and a graph JSON dump.

## Plugins & themes

**Settings → Plugins** has two tabs. **Core plugins** are the eight
first-party ones built into the app — screenplay mode, comic rail, story
canvas, medium exporters, and friends — on by default, nothing to install
or trust; toggle off what you don't use. **Installed plugins** is for
plugins you add from a folder yourself: the first enable shows one blunt
dialog (plugins run with the app's full access; install only what you
trust), and **Restricted mode** silences all third-party plugins while the
core ones stay on. A community plugin shelf is coming after beta.

**Themes** live on their own rail panel: apply, remove, and install from
the community shelf. The built-in dark theme is always there; two seed
themes (light and quiet) ship in the shelf.

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
| Ctrl/Cmd-B / I       | Bold / italic                             |
| Ctrl/Cmd-K           | Link                                      |
| Ctrl/Cmd-1 / 2 / 3   | Heading 1 / 2 / 3                         |
| Ctrl/Cmd-Shift-Enter | Focus mode                                |
| Ctrl/Cmd-click       | Open a link or mention                    |

## Updates & privacy

On start, Edenwright checks GitHub for a newer release and tells you —
that's the whole conversation. No telemetry, no analytics, no accounts. The
community themes shelf's registry fetch and the update check are the only
network calls, and both fail silently offline.
