# EDENWRIGHT — Product & Build Specification (v2)

**Version:** 2.1 · writer-first rework · **Target release:** 0.1.0-beta · **Supersedes:** SPEC v1 (engine model — a prototype, deleted; local reference branch `archive/engines-model`)
**License:** MIT (everything)

---

## 0. Why v2

Iteration one shipped five **engines** — code packages, one per medium. Wrong shape: every medium shares one story skeleton, and the difference between a novel, a manga, and a screenplay is **data, not code**. V2 keeps the design, the plain-files promise, and every medium-agnostic subsystem, and replaces the engine system with one unified writer driven by **presets**.

## 1. Thesis

**Edenwright is an open-source desktop studio for every kind of story.** Like Obsidian, but built solely for writers: local-first, plain files you own forever, endlessly extensible through community plugins and zero-code presets. Novels, comics, screenplays, story-games, worldbuilding — one skeleton, many costumes.

Non-goals for beta: no sync/accounts/cloud, no real-time collaboration, no mobile builds (portable core keeps them cheap later), no AI writing features in core, no telemetry, no web version.

## 2. Pillars (law)

1. **Plain files are the only truth.** The index is a disposable cache; delete it, lose nothing.
2. **One skeleton, presets as data.** An eden is one folder that IS the story: a tree of Markdown documents, one `world/` for the codex layer, and `eden.json`. A medium is a preset: terminology, structure, defaults, scaffold. There is no engine code per medium.
3. **Everything real runs on the public plugin API.** Medium-specific powers (screenplay mode, comic rail, story canvas, medium exporters) are plugins consuming the same API the community gets.
4. **Gorgeous by default.** No gray boxes; every surface from tokens; every state designed; dark-first.
5. **Portable core.** Pure TypeScript packages, zero Electron/Node/DOM imports; the shell is an adapter.
6. **Community where it's ready.** Community themes ship at launch (registry-backed shelf, offline fallback); the eight first-party medium/companion plugins are built in as core plugins. Community _plugins_ (registry, browse/install) are deferred to post-beta — the registry data and validator stay ready for the return.

## 3. Brand, architecture, data model

Unchanged from v1 and kept: §3 brand tokens (leaf/abyss/void/ink, Space Grotesk/Literata/JetBrains Mono/Courier Prime, bloom icon, two-word lexicon: **eden** + **codex**), the pnpm monorepo (`apps/desktop`, `packages/core`, `packages/plugin-api`, `packages/ui`, `packages/exporters`), the Portable Core Law (ESLint-enforced), YAML frontmatter, `[[wiki-links]]`/`@mentions`, SQLite index behind an adapter, snapshots + conflict copies + atomic writes.

The eden layout after the writer-first rework: one eden = one story. The eden folder root holds `eden.json` (the one manifest), the preset scaffold stamped beside it, one fixed `world/` (`codex/`, `notes/`, `maps/`), `exports/`, and `.eden/` for everything machine-managed. No `Projects/`, no `Worlds/`, no linked worlds — legacy edens migrate on open (backup in `.eden/migration-backup/`; multi-story edens split into siblings, original kept as `<name>-legacy`).

## 4. The preset system (the heart of v2)

### 4.1 Preset = data

```ts
interface PresetDefinition {
  id: string;                 // "novel", "manga", "feature-film"
  name: string;
  description?: string;
  icon?: string;              // Lucide name
  medium: string;             // "prose" | "screenplay" | "comic" | "interactive" | "world" (free-form; built-ins documented)
  terminology: { document: string; documents: string };
  structure: { id: string; label: string; required?: boolean }[];
  defaultFields: Record<string, unknown>;   // stamped into new documents' frontmatter
  scaffold: { path: string; contents?: string }[];  // stamped at eden creation
  exportDefaults?: string[];
  suggestedPlugins?: string[];
}
```

- `eden.json` stores `{ preset, medium }` (medium denormalized for joins).
- Built-ins (~20) ship as one data module in `packages/core` — not plugins.
- Community presets register through `ctx.presets.register()` — zero code.

### 4.2 The `medium` join

`medium` is the only engine-remnant concept, and it's just a string tag:

- **Export dialog:** universal exporters (no `media`) + exporters whose `media` includes the eden's medium.
- **Medium plugins:** activate editor modes/views for edens of their medium (checked against the open eden's preset).

### 4.3 Eden skeleton

Every eden: `eden.json` + the preset scaffold folders at the root + one fixed `world/` (`codex/`, `notes/`, `maps/`) + `exports/` (gitignored by template). The worldbuilding preset simply leans on `world/` — there is no second container kind, and no `Projects/`/`Worlds/` anywhere.

## 5. Medium plugins (first-party seeds)

- **screenplay-mode** — Courier Prime, element inference + Tab cycling, minute estimate (media: screenplay).
- **comic-rail** — PAGE/PANEL structure aids + page-flow rail (media: comic).
- **story-canvas** — node canvas over `graph.json` + walk mode (media: interactive).
- **medium-exporters** — Fountain/FDX/screenplay PDF; comic script PDF/docx; Ren'Py/Twee/outline/JSON (media: screenplay/comic/interactive).
- Plus the v1 seeds: structure-wizards, sprints, namesmith, stats-deluxe, extra-exporters.

## 6. Exports

Built-in universal formats (every eden): clean Markdown, single-file HTML, print PDF (printToPDF), manuscript docx, EPUB 3, Markdown zip — via `packages/exporters`. Medium serializations live in medium plugins (§5). Exporters are plugin-API citizens with golden-file tests where testable (plugins self-test via the app's e2e).

## 7. Plugin system

As v1 §9: folder plugins (`manifest.json` + `main.js` + optional `styles.css`), the typed API (commands, views/panels, editor extensions, settings tabs, entity types, exporters, presets, file events, index reads, notices, `ctx.eden.fs`), trust dialog + restricted mode, theme system (default dark non-uninstallable).

The writer-first rework splits the shelf in two:

- **Core plugins** — the eight first-party seeds (§5), loaded straight from the app bundle, default ON per eden (opt-outs in `settings.plugins.coreDisabled`), no trust dialog, no uninstall. Same evaluation path as folder plugins; the privilege is in the source, not the runtime.
- **Installed plugins** — folder-installed third-party plugins: trust dialog on first enable, and restricted mode, which now honestly means "no third-party code" (it silences folder plugins only; core plugins are first-party and exempt).

The community plugin registry (browse/search/install in-app, PR submissions) is **deferred to post-beta** (§9); the registry data and `validate.mjs` stay in-repo, ready for the return. The community THEMES shelf keeps its registry fetch — with the update check, one of only two network calls.

## 8. Quality bar & milestones

§11's bar stands (tokens only, designed states, perf budgets, data safety). Build phases:

- **P0/P1** Skeleton + ported core/editor (one root commit)
- **P2** Preset system + plugin runtime v2
- **P3** Universal exports
- **P4** Community + medium plugins
- **P5** Polish → 0.2.0-beta

## 9. Deferred on purpose

Final icon art and tagline (founder's), light-as-default, mobile, sync docs, i18n scaffolding, AI writing features in core, **the community plugin registry** (browse/install in-app; data + validator kept in-repo for the return).

Known edge we're shipping with: a multi-story legacy eden migrates by splitting into siblings and keeping the original as `<name>-legacy` — and that `-legacy` folder still looks pre-collapse, so opening _it_ migrates it again. Harmless (a backup of a backup), but don't be surprised.
