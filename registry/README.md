# Registry fixture (offline fallback)

The live community index is
[lablooms/edenwright-registry](https://github.com/lablooms/edenwright-registry) —
submission = PR over there.

This directory is the copy bundled into the app. Today only `community-themes.json`
is read: when the registry fetch fails (offline, dev), the community themes shelf
falls back to these entries so it's never an empty shelf. `community-plugins.json`
is kept schema-valid for the community plugin shelf's return after beta (SPEC §9).
Refresh from the registry repo at release time; `pnpm test:registry` keeps both
copies schema-valid.
