# GAP-55: Identity: @fetchable

> [!NOTE]
> This is a scaffold. Sections marked _TODO_ still need to be written.
>
> This proposal has a companion: **Identity: @strong**
> ([GAP-54](../GAP-54/README.md)), which `@fetchable` builds on.

## Overview

This proposal defines the **`@fetchable`** schema directive, which declares that
a type can be independently (re-)fetched from a type-specific root field given a
field value that identifies it.

For a `@fetchable` type `Type`, the schema guarantees generated root fields:

- `Query.fetch__Type(id: ID!): Type` — single-item fetch
- `Query.multifetch__Type(ids: [ID!]!): [TypeMultiFetchEdge!]!` — batch fetch
- `type TypeMultiFetchEdge { node: Type, node_id: ID }`

`@fetchable` builds on the companion **`@strong`** directive (see
[Identity: @strong](../GAP-54/README.md)): every `@fetchable` type must also be
`@strong`, though the two directives need not reference the same field — identity
and fetchability may be backed by different fields.

## Motivation

<!-- TODO: Explain the problem `@fetchable` solves. Sketch:
  - Clients need to re-resolve objects standalone (refetch, eviction, optimistic
    updates) without replaying the original operation.
  - `node(id:)` resolution can be costly; type-specific root fields can be faster.
  - Separating a large fetch token from a small identity field improves caching.
-->

_TODO._

## Relationship to prior art

This is an alternative form of fetchability to the
[Global Object Identification Specification](https://relay.dev/graphql/objectidentification.htm)
(the `Node` interface and `node(id:)` root field).

Related discussions and prior art:

- [Global Object Identification](https://relay.dev/graphql/objectidentification.htm).
- [Apollo Federation entities and `@key`](https://www.apollographql.com/docs/federation/entities/).
- Companion proposal: [Identity: @strong](../GAP-54/README.md).

## Status

**Proposal.** Initial draft; not yet sponsored.

## Challenges and drawbacks

<!-- TODO: Enumerate open questions and trade-offs. Sketch:
  - Naming convention for generated fields (`fetch__`/`multifetch__`) and the
    `MultiFetchEdge` type.
  - Nullability/ordering of `multifetch__` results; behavior on unknown ids.
  - Interaction with abstract types and interface implementation.
  - Overlap/migration from `node(id:)` and Federation entities.
-->

_TODO._
