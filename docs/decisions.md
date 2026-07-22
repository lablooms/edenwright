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
