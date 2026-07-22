[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / EditorRegistry

# Interface: EditorRegistry

Defined in: editor.ts:25

## Methods

### registerExtension()

> **registerExtension**(`extension`): [`Disposable`](Disposable.md)

Defined in: editor.ts:30

Register a CM6 extension for every editor, or a factory computed per
editor — return null to sit that editor out (medium gating).

#### Parameters

##### extension

`Extension` \| [`EditorExtensionFactory`](../type-aliases/EditorExtensionFactory.md)

#### Returns

[`Disposable`](Disposable.md)
