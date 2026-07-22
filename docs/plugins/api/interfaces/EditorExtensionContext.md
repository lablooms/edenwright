[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / EditorExtensionContext

# Interface: EditorExtensionContext

Defined in: editor.ts:12

Context handed to an extension factory for each editor instance.

## Properties

### filePath

> **filePath**: `string`

Defined in: editor.ts:14

Eden-relative path of the file in this editor.

***

### medium

> **medium**: `string` \| `null`

Defined in: editor.ts:16

The owning project preset's medium tag, when the file is in a project.

***

### preset

> **preset**: `string` \| `null`

Defined in: editor.ts:18

The owning project preset's id, when the file is in a project.
