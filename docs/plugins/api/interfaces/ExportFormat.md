[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / ExportFormat

# Interface: ExportFormat

Defined in: exporters.ts:9

Exporters (SPEC v2 §7.2, §8). An exporter turns a project into files in the
project's `exports/` folder. Universal formats ship with the app; medium
conventions (Fountain, Ren'Py, …) arrive through this same hook in plugins.

## Properties

### fileExtension

> **fileExtension**: `string`

Defined in: exporters.ts:14

***

### id

> **id**: `string`

Defined in: exporters.ts:11

Format id, e.g. "docx", "epub", "fountain".

***

### label

> **label**: `string`

Defined in: exporters.ts:13

Dialog label, e.g. "Word (.docx)".
