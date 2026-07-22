[**@edenwright/plugin-api**](../README.md)

***

[@edenwright/plugin-api](../README.md) / SearchFilter

# Interface: SearchFilter

Defined in: index-queries.ts:6

Read-only index queries (SPEC §9.2). The index derives from plain files and
is rebuildable; plugins read through here and never write to it.

## Properties

### containerPath?

> `optional` **containerPath?**: `string`

Defined in: index-queries.ts:8

Restrict to one project or world folder.

***

### kind?

> `optional` **kind?**: `"manuscript"` \| `"codex"` \| `"note"`

Defined in: index-queries.ts:12

Filter by document kind.

***

### status?

> `optional` **status?**: `string`

Defined in: index-queries.ts:10

Filter by frontmatter `status` value.
