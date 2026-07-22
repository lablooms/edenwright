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
