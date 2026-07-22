[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / PluginContext

# Interface: PluginContext

Defined in: context.ts:27

Everything a plugin can do (SPEC v2 §7.2). Handed to `onload` by the
runtime. First-party plugins consume exactly this surface — no backdoors.

## Properties

### appVersion

> `readonly` **appVersion**: `string`

Defined in: context.ts:28

***

### commands

> `readonly` **commands**: [`CommandRegistry`](CommandRegistry.md)

Defined in: context.ts:32

***

### eden

> `readonly` **eden**: [`EdenAccess`](EdenAccess.md)

Defined in: context.ts:30

***

### editor

> `readonly` **editor**: [`EditorRegistry`](EditorRegistry.md)

Defined in: context.ts:34

***

### entities

> `readonly` **entities**: [`EntityRegistry`](EntityRegistry.md)

Defined in: context.ts:36

***

### events

> `readonly` **events**: [`FileEventRegistry`](FileEventRegistry.md)

Defined in: context.ts:39

***

### exporters

> `readonly` **exporters**: [`ExporterRegistry`](ExporterRegistry.md)

Defined in: context.ts:37

***

### index

> `readonly` **index**: [`IndexQueryApi`](IndexQueryApi.md)

Defined in: context.ts:40

***

### manifest

> `readonly` **manifest**: [`PluginManifest`](PluginManifest.md)

Defined in: context.ts:29

***

### notices

> `readonly` **notices**: [`NoticeApi`](NoticeApi.md)

Defined in: context.ts:41

***

### presets

> `readonly` **presets**: [`PresetRegistry`](PresetRegistry.md)

Defined in: context.ts:38

***

### settings

> `readonly` **settings**: [`SettingsRegistry`](SettingsRegistry.md)

Defined in: context.ts:35

***

### workspace

> `readonly` **workspace**: [`WorkspaceRegistry`](WorkspaceRegistry.md)

Defined in: context.ts:33
