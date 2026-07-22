[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / ManifestValidation

# Type Alias: ManifestValidation

> **ManifestValidation** = \{ `manifest`: [`PluginManifest`](../interfaces/PluginManifest.md); `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}

Defined in: validation.ts:9

Manifest validation (SPEC §9.1, §9.3). The loader calls this before a
plugin's code ever runs; the registry CI uses the same checks, so what
you test locally is what the community repo enforces.
