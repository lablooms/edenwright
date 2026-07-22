[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / PluginManifest

# Interface: PluginManifest

Defined in: manifest.ts:5

Plugin manifest (`manifest.json` in `.eden/plugins/<id>/`), SPEC §9.1.

## Properties

### author

> **author**: `string`

Defined in: manifest.ts:15

***

### authorUrl?

> `optional` **authorUrl?**: `string`

Defined in: manifest.ts:16

***

### description

> **description**: `string`

Defined in: manifest.ts:14

***

### fundingUrl?

> `optional` **fundingUrl?**: `string`

Defined in: manifest.ts:17

***

### id

> **id**: `string`

Defined in: manifest.ts:7

Unique plugin id, reverse-domain style, e.g. "lablooms.screenplay-mode".

***

### minAppVersion

> **minAppVersion**: `string`

Defined in: manifest.ts:13

Minimum Edenwright version required, semver.

***

### name

> **name**: `string`

Defined in: manifest.ts:9

Human-readable name shown in the Plugins tab.

***

### version

> **version**: `string`

Defined in: manifest.ts:11

Semver version string.
