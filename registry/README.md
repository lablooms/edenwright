# Registry fixture (offline fallback)

The live community index is
[lablooms/edenwright-registry](https://github.com/lablooms/edenwright-registry) —
submission = PR over there.

This directory is the copy bundled into the app: when the registry fetch fails
(offline, dev), the community tab falls back to these entries so it's never an
empty shelf (SPEC §9.4). Refresh it from the registry repo at release time;
`pnpm test:registry` keeps both copies schema-valid.
