[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / ExportRunContext

# Interface: ExportRunContext

Defined in: exporters.ts:17

## Properties

### fs

> **fs**: `FileSystemAdapter`

Defined in: exporters.ts:25

File access scoped to the eden (eden-relative paths).

***

### outputDir

> **outputDir**: `string`

Defined in: exporters.ts:21

Eden-relative path of the output folder (usually `<project>/exports`).

***

### projectPath

> **projectPath**: `string`

Defined in: exporters.ts:19

Eden-relative path of the project being exported.

***

### scope

> **scope**: `string`[]

Defined in: exporters.ts:23

Structure-node ids selected in the export dialog; empty = everything.

## Methods

### renderPdf()

> **renderPdf**(`html`, `outRelPath`): `Promise`\<`void`\>

Defined in: exporters.ts:30

Render print-clean HTML to a PDF file (eden-relative out path). The
shell implements this with Electron's printToPDF — fast, offline (§10).

#### Parameters

##### html

`string`

##### outRelPath

`string`

#### Returns

`Promise`\<`void`\>

***

### reportProgress()

> **reportProgress**(`fraction`): `void`

Defined in: exporters.ts:40

Report 0–1 progress for long exports.

#### Parameters

##### fraction

`number`

#### Returns

`void`

***

### writeZip()

> **writeZip**(`entries`, `outRelPath`): `Promise`\<`void`\>

Defined in: exporters.ts:35

Write a zip archive of export files (eden-relative out path). Paths
inside the archive are relative to the project root.

#### Parameters

##### entries

`object`[]

##### outRelPath

`string`

#### Returns

`Promise`\<`void`\>
