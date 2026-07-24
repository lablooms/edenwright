# AGENTS.md — Edenwright

Standing law for AI agents working in this repository. `SPEC.md` is the full specification; this file is what stays true at all times. If they ever conflict, ask the founder.

## What this is

Edenwright — an open-source desktop studio for every kind of story (novels, comics, screenplays, story-games, worldbuilding). Second app from Lablooms Studio. One unified writer, presets as data, one eden = one story. Medium powers ship as built-in **core plugins** on the public API; community plugins are deferred to post-beta (community themes remain, registry data kept for the return). Electron shell, portable TypeScript core, plain files on disk. Target: `0.1.0-beta` on Windows, Linux, macOS. License: MIT, everything.

(Iteration one — the engine model — was a prototype and was deleted; a local-only reference branch `archive/engines-model` exists for porting. Never push it.)

## Golden rules

1. **Plain files are the only truth.** The SQLite index (`.eden/index.db`) is a disposable cache. Never store anything there that can't be rebuilt from files. Never write user content anywhere but their eden folder. Atomic writes (temp + rename). Snapshot before any bulk file operation.
2. **Portable Core Law.** `packages/core` and `packages/plugin-api` must not import Electron, Node built-ins, or browser storage. Platform capabilities go through adapter interfaces defined in core, implemented in `apps/desktop`. The ESLint rule enforcing this must stay green.
3. **One skeleton, presets as data.** There are no engines. A medium is a preset (terminology, structure, defaults, scaffold). Never add medium-specific code to core, the shell, or the editor — that belongs in a medium plugin or a preset's data.
4. **Dogfood the plugin API.** Medium powers (screenplay mode, comic rail, story canvas, medium exporters) are plugins on the public API. If a plugin needs something the API can't do, extend the API — never a private backdoor.
5. **No gray boxes.** All colors from CSS custom properties (SPEC v1 §3.1, kept). No hardcoded hex in components. Every empty state, loading state, and error state is designed. Dark-first Edenwright theme.
6. **Vocabulary law.** Exactly two brand words in the UI: **eden** (workspace) and **codex** (entity layer). Everything else is plain English: Projects, Worlds, Plugins, Themes, History, Search. Never invent additional archaic terms.
7. **Privacy is absolute.** No telemetry, no analytics, no network calls except: the community-themes registry fetch and the update check. Both fail silently offline. (The community-plugin registry fetch is deferred to post-beta with the community plugins UI.)
8. **Never lose a word.** When in doubt between data safety and anything else, data safety wins.

## Stack

- TypeScript strict everywhere; no `any` without an inline justification comment.
- Electron (current stable) + electron-builder · React 18 + Vite · CodeMirror 6 (editor) · Zustand (state) · better-sqlite3 behind the index adapter (shell only) · chokidar (watching, shell only) · Lucide icons.
- Node ≥ 22 LTS, pnpm ≥ 9, pnpm workspaces monorepo (`apps/desktop`, `packages/core`, `packages/plugin-api`, `packages/ui`, `packages/exporters`).

## Commands

```
pnpm install          # bootstrap
pnpm dev              # run desktop app in dev
pnpm test             # vitest (core, plugin-api, exporters, desktop)
pnpm test:e2e         # playwright smoke tests against the built app
pnpm test:registry    # validate registry/community-*.json (SPEC §7)
pnpm lint             # eslint + prettier check (includes core-purity rule)
pnpm typecheck        # tsc --noEmit across workspaces
pnpm build            # production build all packages
pnpm package          # electron-builder, current OS
```

Keep all of these green before every checkpoint. If you add a script, document it here.

## Code conventions

- Prettier defaults; ESLint errors are blockers, not suggestions.
- Functional React components + hooks; no class components.
- Files kebab-case; types/interfaces PascalCase; CSS custom properties prefixed `--ew-`.
- Comments explain _why_, not _what_. Public `plugin-api` surfaces get TSDoc — that's the plugin developers' documentation.
- Tests: vitest for core logic (file model, links, index derivations, exporters — exporters especially: golden-file tests); Playwright smoke per phase (app opens, eden creates, file edits persist, presets scaffold).

## Workflow

- Build **phase by phase** per SPEC v2 §8. At each phase's end: summarize what was built, how to run it, known gaps — then **stop and wait for founder review**.
- **Nothing is pushed to GitHub without the founder's word.** When a push does happen, it goes to the **lablooms organization**.
- Deviating from SPEC requires asking first. Small implementation choices inside spec bounds are yours; record notable ones in `docs/decisions.md` (one line each).
- Maintain `CHANGELOG.md`. Style: conventional-commit titles; personality welcome in the body; rough edges listed honestly — "serious tool, silly changelog" is a Lablooms value.
- Commits: conventional commits (`feat(presets): manga scaffold`), small and coherent.

## Definition of done (every phase)

Green `lint`, `typecheck`, `test`; the app builds and launches; new UI passes the design QA list (tokens only, designed states); no console errors on the happy path; CHANGELOG updated; checkpoint summary written.
