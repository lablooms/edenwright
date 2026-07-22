# Contributing to Edenwright

First: thank you. Edenwright is built in the open, milestone by milestone,
and the door is genuinely open.

## Dev setup

Requires **Node ≥ 22 LTS** and **pnpm ≥ 9**.

```sh
git clone https://github.com/lablooms/edenwright.git
cd edenwright
pnpm install
pnpm dev        # the app, hot reload
```

Keep these green before you push (CI will check on all three OSes):

```sh
pnpm lint         # eslint + prettier — includes the Portable Core Law rule
pnpm typecheck    # tsc --noEmit across workspaces
pnpm test         # vitest unit tests
pnpm test:e2e     # Playwright against the built app
```

## The law of the house

`AGENTS.md` is standing law — read it before your first PR. The short
version:

1. **Plain files are the only truth.** The SQLite index is a disposable
   cache. Atomic writes. Snapshot before bulk operations. **Never lose a
   word** — data safety wins every tradeoff.
2. **Portable Core Law.** `packages/core`, `packages/plugin-api`, and
   `engines/*` import zero Electron, Node built-ins, or browser storage.
   Platform capability goes through adapter interfaces defined in core and
   implemented in `apps/desktop`. ESLint enforces it.
3. **Dogfood the plugin API.** The five engines are plugins. If an engine
   needs something the public API can't do, extend the API — never a private
   backdoor.
4. **No gray boxes.** All colors from CSS custom properties. Every empty,
   loading, and error state is designed.
5. **Privacy is absolute.** No telemetry. Network calls are limited to the
   registry and the update check, both silent offline.
6. **Vocabulary law.** Exactly two brand words: **eden** and **codex**.
   Everything else is plain English.

## How to PR

- **Small, coherent commits** with conventional-commit titles
  (`feat(engine-comic): panel rail drag`).
- **Match the room.** Prettier defaults, kebab-case files, PascalCase types,
  `--ew-` CSS variables. Comments explain _why_, not _what_.
- **Tests travel with features.** Vitest for core logic and exporters
  (golden files), Playwright for app behavior.
- **Deviating from SPEC.md? Ask first** — open an issue. Implementation
  choices inside spec bounds are yours; notable ones get a line in
  `docs/decisions.md`.
- Keep `CHANGELOG.md` honest — rough edges listed proudly, never hidden.

## Good first territories

- **Exporters** — new formats are self-contained and golden-testable.
- **Seed-quality plugins** — see `plugins/seed/` and `docs/plugins/`.
- **Design QA** — run the app against SPEC §11 and file what you find.

## Community plugins & themes

To ship a plugin or theme for the community tab, you want the
[registry repo](https://github.com/lablooms/edenwright-registry), not this
one — submission is a PR there. The dev docs live in
[docs/plugins/](docs/plugins/README.md).

## Code of conduct

Be kind, be specific, assume the best reading. Serious tool, silly
changelog, warm humans.
