[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / Command

# Interface: Command

Defined in: commands.ts:4

A command appears in the command palette and can be bound to a hotkey.

## Properties

### callback

> **callback**: () => `void`

Defined in: commands.ts:11

#### Returns

`void`

***

### hotkey?

> `optional` **hotkey?**: `string`

Defined in: commands.ts:10

Optional default hotkey, e.g. "Mod-Shift-P". Users can rebind.

***

### id

> **id**: `string`

Defined in: commands.ts:6

Unique id, conventionally "<plugin-id>:<verb>", e.g. "sprints:start".

***

### name

> **name**: `string`

Defined in: commands.ts:8

Palette label, plain English.
