[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / Disposable

# Interface: Disposable

Defined in: disposable.ts:7

Every registration returns a Disposable. Disposing undoes the registration;
the runtime disposes everything a plugin registered when it unloads, so a
well-behaved plugin can simply keep its disposables and let go.

## Methods

### dispose()

> **dispose**(): `void`

Defined in: disposable.ts:8

#### Returns

`void`
