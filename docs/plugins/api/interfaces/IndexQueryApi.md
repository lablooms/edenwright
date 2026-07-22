[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / IndexQueryApi

# Interface: IndexQueryApi

Defined in: index-queries.ts:67

## Methods

### getBacklinks()

> **getBacklinks**(`filePath`): `Promise`\<[`LinkRef`](LinkRef.md)[]\>

Defined in: index-queries.ts:70

#### Parameters

##### filePath

`string`

#### Returns

`Promise`\<[`LinkRef`](LinkRef.md)[]\>

***

### getDailyWords()

> **getDailyWords**(`containerPath`, `days`): `Promise`\<[`DailyWordCount`](DailyWordCount.md)[]\>

Defined in: index-queries.ts:74

Per-day word totals for a container (project or world path).

#### Parameters

##### containerPath

`string`

##### days

`number`

#### Returns

`Promise`\<[`DailyWordCount`](DailyWordCount.md)[]\>

***

### getEntityAppearances()

> **getEntityAppearances**(`entityId`): `Promise`\<[`AppearanceRef`](AppearanceRef.md)[]\>

Defined in: index-queries.ts:71

#### Parameters

##### entityId

`string`

#### Returns

`Promise`\<[`AppearanceRef`](AppearanceRef.md)[]\>

***

### getFileInfo()

> **getFileInfo**(`path`): `Promise`\<[`IndexedFileInfo`](IndexedFileInfo.md) \| `null`\>

Defined in: index-queries.ts:72

#### Parameters

##### path

`string`

#### Returns

`Promise`\<[`IndexedFileInfo`](IndexedFileInfo.md) \| `null`\>

***

### getOutgoingLinks()

> **getOutgoingLinks**(`filePath`): `Promise`\<[`LinkRef`](LinkRef.md)[]\>

Defined in: index-queries.ts:69

#### Parameters

##### filePath

`string`

#### Returns

`Promise`\<[`LinkRef`](LinkRef.md)[]\>

***

### listEntities()

> **listEntities**(`containerPath?`): `Promise`\<[`IndexedEntity`](IndexedEntity.md)[]\>

Defined in: index-queries.ts:76

All indexed entities, optionally scoped to one container.

#### Parameters

##### containerPath?

`string`

#### Returns

`Promise`\<[`IndexedEntity`](IndexedEntity.md)[]\>

***

### searchText()

> **searchText**(`query`, `filter?`): `Promise`\<[`SearchHit`](SearchHit.md)[]\>

Defined in: index-queries.ts:68

#### Parameters

##### query

`string`

##### filter?

[`SearchFilter`](SearchFilter.md)

#### Returns

`Promise`\<[`SearchHit`](SearchHit.md)[]\>
