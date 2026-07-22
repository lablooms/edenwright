# EDENWRIGHT — Product & Build Specification (v2)

**Version:** 2.0 · **Target release:** 0.1.0-beta · **Supersedes:** SPEC v1 (engine model — a prototype, deleted; local reference branch `archive/engines-model`)
**License:** MIT (everything)

---

## 0. Why v2

Iteration one shipped five **engines** — code packages, one per medium. Wrong shape: every medium shares one story skeleton, and the difference between a novel, a manga, and a screenplay is **data, not code**. V2 keeps the design, the plain-files promise, and every medium-agnostic subsystem, and replaces the engine system with one unified writer driven by **presets**.

## 1. Thesis

**Edenwright is an open-source desktop studio for every kind of story.** Like Obsidian, but built solely for writers: local-first, plain files you own forever, endlessly extensible through community plugins and zero-code presets. Novels, comics, screenplays, story-games, worldbuilding — one skeleton, many costumes.

Non-goals for beta: no sync/accounts/cloud, no real-time collaboration, no mobile builds (portable core keeps them cheap later), no AI writing features in core, no telemetry, no web version.

## 2. Pillars (law)

1. **Plain files are the only truth.** The index is a disposable cache; delete it, lose nothing.
2. **One skeleton, presets as data.** A project is a tree of Markdown documents + codex + `project.json`. A medium is a preset: terminology, structure, defaults, scaffold. There is no engine code per medium.
3. **Everything real runs on the public plugin API.** Medium-specific powers (screenplay mode, comic rail, story canvas, medium exporters) are plugins consuming the same API the community gets.
4. **Gorgeous by default.** No gray boxes; every surface from tokens; every state designed; dark-first.
5. **Portable core.** Pure TypeScript packages, zero Electron/Node/DOM imports; the shell is an adapter.
6. **Community from day one.** Community tab, registry, seed plugins and themes at launch.

## 3. Brand, architecture, data model

Unchanged from v1 and kept: §3 brand tokens (leaf/abyss/void/ink, Space Grotesk/Literata/JetBrains Mono/Courier Prime, bloom icon, two-word lexicon: **eden** + **codex**), the pnpm monorepo (`apps/desktop`, `packages/core`, `packages/plugin-api`, `packages/ui`, `packages/exporters`), the Portable Core Law (ESLint-enforced), eden layout (`Projects/`, `Worlds/`, `.eden/`), YAML frontmatter, `[[wiki-links]]`/`@mentions`, SQLite index behind an adapter, snapshots + conflict copies + atomic writes.

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
  scaffold: { path: string; contents?: string }[];  // stamped at project creation
  home?: "projects" | "worlds";
  exportDefaults?: string[];
  suggestedPlugins?: string[];
}
```

- `project.json` stores `{ preset, medium }` (medium denormalized for joins).
- Built-ins (~20) ship as one data module in `packages/core` — not plugins.
- Community presets register through `ctx.presets.register()` — zero code.

### 4.2 The `medium` join

`medium` is the only engine-remnant concept, and it's just a string tag:

- **Export dialog:** universal exporters (no `media`) + exporters whose `media` includes the project's medium.
- **Medium plugins:** activate editor modes/views for projects of their medium (checked against the open file's project preset).

### 4.3 Project skeleton

Every project: `project.json` + preset scaffold folders + `exports/` (gitignored by template). Worlds remain shared-canon containers in `Worlds/` with `world.json`; the worldbuilding preset's `home: "worlds"` routes its creation there.

## 5. Medium plugins (first-party seeds)

- **screenplay-mode** — Courier Prime, element inference + Tab cycling, minute estimate (media: screenplay).
- **comic-rail** — PAGE/PANEL structure aids + page-flow rail (media: comic).
- **story-canvas** — node canvas over `graph.json` + walk mode (media: interactive).
- **medium-exporters** — Fountain/FDX/screenplay PDF; comic script PDF/docx; Ren'Py/Twee/outline/JSON (media: screenplay/comic/interactive).
- Plus the v1 seeds: structure-wizards, sprints, namesmith, stats-deluxe, extra-exporters.

## 6. Exports

Built-in universal formats (all projects): clean Markdown, single-file HTML, print PDF (printToPDF), manuscript docx, EPUB 3, Markdown zip — via `packages/exporters`. Medium serializations live in medium plugins (§5). Exporters are plugin-API citizens with golden-file tests where testable (plugins self-test via the app's e2e).

## 7. Plugin system

As v1 §9: folder plugins (`manifest.json` + `main.js` + optional `styles.css`), the typed API (commands, views/panels, editor extensions, settings tabs, entity types, exporters, presets, file events, index reads, notices, `ctx.eden.fs`), trust dialog + restricted mode, registry repo with PR submissions, theme system (default dark non-uninstallable).

## 8. Quality bar & milestones

§11's bar stands (tokens only, designed states, perf budgets, data safety). Build phases:

- **P0/P1** Skeleton + ported core/editor (one root commit)
- **P2** Preset system + plugin runtime v2
- **P3** Universal exports
- **P4** Community + medium plugins
- **P5** Polish → 0.2.0-beta

## 9. Deferred on purpose

Final icon art and tagline (founder's), light-as-default, mobile, sync docs, i18n scaffolding, AI writing features in core.
