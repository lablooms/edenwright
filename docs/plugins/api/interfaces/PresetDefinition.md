[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / PresetDefinition

# Interface: PresetDefinition

Defined in: presets.ts:24

## Properties

### defaultFields

> **defaultFields**: `Record`\<`string`, `unknown`\>

Defined in: presets.ts:42

Default frontmatter field values stamped on new documents.

***

### description?

> `optional` **description?**: `string`

Defined in: presets.ts:28

***

### exportDefaults?

> `optional` **exportDefaults?**: `string`[]

Defined in: presets.ts:48

Preferred export format ids; the first is the dialog's default.

***

### home?

> `optional` **home?**: `"projects"` \| `"worlds"`

Defined in: presets.ts:46

Where the preset's works live: `Projects/` or `Worlds/`.

***

### icon?

> `optional` **icon?**: `string`

Defined in: presets.ts:30

Lucide icon name.

***

### id

> **id**: `string`

Defined in: presets.ts:26

Preset id, e.g. "novel", "manga", "feature-film".

***

### medium

> **medium**: `string`

Defined in: presets.ts:36

Medium tag — the join for exporters and medium plugins. Built-ins:
"prose", "screenplay", "comic", "interactive", "world". Free-form by
design: community media are welcome.

***

### name

> **name**: `string`

Defined in: presets.ts:27

***

### scaffold

> **scaffold**: [`ScaffoldEntry`](ScaffoldEntry.md)[]

Defined in: presets.ts:44

Files/folders created with the project.

***

### structure

> **structure**: [`StructureLevel`](StructureLevel.md)[]

Defined in: presets.ts:40

The preset's structure tree (folders in the project).

***

### suggestedPlugins?

> `optional` **suggestedPlugins?**: `string`[]

Defined in: presets.ts:50

Plugin ids worth suggesting (e.g. screenplay-mode for film presets).

***

### terminology

> **terminology**: `object`

Defined in: presets.ts:38

What this medium calls its documents ("Scene"/"Scenes", "Page"/"Pages").

#### document

> **document**: `string`

#### documents

> **documents**: `string`
