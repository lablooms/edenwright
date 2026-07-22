[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / WorkspaceRegistry

# Interface: WorkspaceRegistry

Defined in: workspace.ts:47

## Methods

### openFile()

> **openFile**(`path`): `void`

Defined in: workspace.ts:55

Open an eden-relative file in the main editor.

#### Parameters

##### path

`string`

#### Returns

`void`

***

### openView()

> **openView**(`id`): `void`

Defined in: workspace.ts:53

Bring a registered view to the front in the workspace's side panel.

#### Parameters

##### id

`string`

#### Returns

`void`

***

### registerReactView()

> **registerReactView**(`view`): [`Disposable`](Disposable.md)

Defined in: workspace.ts:49

#### Parameters

##### view

[`ReactViewDefinition`](ReactViewDefinition.md)

#### Returns

[`Disposable`](Disposable.md)

***

### registerRibbonItem()

> **registerRibbonItem**(`item`): [`Disposable`](Disposable.md)

Defined in: workspace.ts:50

#### Parameters

##### item

[`RibbonItem`](RibbonItem.md)

#### Returns

[`Disposable`](Disposable.md)

***

### registerStatusBarItem()

> **registerStatusBarItem**(`item`): [`Disposable`](Disposable.md)

Defined in: workspace.ts:51

#### Parameters

##### item

[`StatusBarItem`](StatusBarItem.md)

#### Returns

[`Disposable`](Disposable.md)

***

### registerView()

> **registerView**(`view`): [`Disposable`](Disposable.md)

Defined in: workspace.ts:48

#### Parameters

##### view

[`VanillaViewDefinition`](VanillaViewDefinition.md)

#### Returns

[`Disposable`](Disposable.md)
