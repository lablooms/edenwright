[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / NoticeApi

# Interface: NoticeApi

Defined in: notices.ts:22

## Methods

### modal()

> **modal**(`options`): `Promise`\<`string` \| `null`\>

Defined in: notices.ts:26

Modal dialog; resolves the chosen action id, or null when dismissed.

#### Parameters

##### options

[`ModalOptions`](ModalOptions.md)

#### Returns

`Promise`\<`string` \| `null`\>

***

### show()

> **show**(`message`, `options?`): `void`

Defined in: notices.ts:24

Transient toast.

#### Parameters

##### message

`string`

##### options?

[`NoticeOptions`](NoticeOptions.md)

#### Returns

`void`
