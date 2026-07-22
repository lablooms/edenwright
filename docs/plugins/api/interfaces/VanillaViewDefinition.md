[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / VanillaViewDefinition

# Interface: VanillaViewDefinition

Defined in: workspace.ts:10

Workspace surfaces (SPEC §9.2): views, panels, ribbon items, status bar.
A view may be vanilla (render into an element) or React (a component).

## Properties

### icon?

> `optional` **icon?**: `string`

Defined in: workspace.ts:14

Lucide icon name.

***

### id

> **id**: `string`

Defined in: workspace.ts:11

***

### render

> **render**: (`element`) => `void` \| (() => `void`)

Defined in: workspace.ts:16

Render into `element`; return an optional cleanup.

#### Parameters

##### element

`HTMLElement`

#### Returns

`void` \| (() => `void`)

***

### title

> **title**: `string`

Defined in: workspace.ts:12
