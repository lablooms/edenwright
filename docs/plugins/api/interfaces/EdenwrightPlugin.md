[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / EdenwrightPlugin

# Interface: EdenwrightPlugin

Defined in: plugin.ts:8

An Edenwright plugin (SPEC §9.1). A plugin is a folder with a manifest and
a `main.js` default-exporting this shape.

## Properties

### manifest

> `readonly` **manifest**: [`PluginManifest`](PluginManifest.md)

Defined in: plugin.ts:9

## Methods

### onload()

> **onload**(`context`): `void` \| `Promise`\<`void`\>

Defined in: plugin.ts:11

Called when the plugin is enabled. Register everything here.

#### Parameters

##### context

[`PluginContext`](PluginContext.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onunload()?

> `optional` **onunload**(): `void` \| `Promise`\<`void`\>

Defined in: plugin.ts:13

Called when disabled. Disposables are auto-disposed; use for the rest.

#### Returns

`void` \| `Promise`\<`void`\>
