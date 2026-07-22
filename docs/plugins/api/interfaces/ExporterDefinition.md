[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / ExporterDefinition

# Interface: ExporterDefinition

Defined in: exporters.ts:43

## Properties

### description?

> `optional` **description?**: `string`

Defined in: exporters.ts:46

***

### formats

> **formats**: [`ExportFormat`](ExportFormat.md)[]

Defined in: exporters.ts:53

***

### id

> **id**: `string`

Defined in: exporters.ts:44

***

### media?

> `optional` **media?**: `string`[]

Defined in: exporters.ts:52

Medium tags this exporter serves ("prose", "screenplay", "comic", …).
Its formats appear in a project's export dialog when the project
preset's `medium` matches. Omit for universal exporters.

***

### name

> **name**: `string`

Defined in: exporters.ts:45

## Methods

### run()

> **run**(`format`, `context`): `Promise`\<`void`\>

Defined in: exporters.ts:54

#### Parameters

##### format

`string`

##### context

[`ExportRunContext`](ExportRunContext.md)

#### Returns

`Promise`\<`void`\>
