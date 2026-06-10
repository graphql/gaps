# Identity: @fetchable

> [!NOTE]
> This is one of a pair of companion proposals. `@fetchable` builds on **Identity:
> @strong** ([GAP-54](../GAP-54/README.md)), which marks types
> as having an identity. The two are designed to be read together but may be
> adopted independently.

```
directive @fetchable(field_name: String!) on OBJECT | INTERFACE
```

## Introduction

:: This document specifies the `@fetchable` schema directive, which declares that
a type can be independently (re-)fetched from a type-specific root field, given a
field value that identifies it.

A `@fetchable` type can be retrieved on its own — without replaying the operation
that originally produced it — through generated root fields keyed on a
type-unique identifier. This enables refetching, cache eviction, and
optimistic-update tooling to re-resolve an object in isolation.

`@fetchable` builds on the companion
[`@strong`](../GAP-54/README.md) directive: a type can only be fetched by an
identifier if it has one, so every `@fetchable` type must also be `@strong`. The
two need not, however, use the same field — `@fetchable(field_name: "<field>")`
does not have to match `@strong(field_name: "<field>")`.

This is an alternative form of fetchability to the
[Global Object Identification Specification](https://relay.dev/graphql/objectidentification.htm).
`@fetchable` may be useful when:

- You want to improve performance by avoiding costly `node(id: $id)` root field
  resolution in favor of type-specific root fields.
- You want to improve performance by separating a field for large tokens required
  for fetchability from a small field for hashed identity.
- You have already created an expensive or non-identifying `id` field that you
  cannot migrate away from.

For a `@fetchable` type `<Type>`, the schema is guaranteed to contain a
single-item root field, a multi-item root field, and an edge type:

```graphql
type Query {
  fetch__PhotoStory(id: ID!): PhotoStory
  multifetch__PhotoStory(ids: [ID!]!): [PhotoStoryMultifetchEdge!]!
}

type PhotoStoryMultifetchEdge {
  node: PhotoStory
  node_id: ID!
}
```

where `node_id` echoes the requested `id` (equal to the resolved `node`'s
`<field_name>` value when present).

**Example**

```graphql
# `Story` is guaranteed to have an identity, but that identity may be expressed
# by a different field across implementations.
interface Story @strong {
  text: String
}

# `EphemeralStory` has an identity (so it can be merged in a normalized cache)
# but is not, on its own, fetchable.
type EphemeralStory implements Story @strong(field_name: "cache_id") {
  cache_id: ID!
  text: String
}

# `PhotoStory` is fetchable: it can be re-resolved on its own via
# `Query.fetch__PhotoStory(id:)`.
type PhotoStory @strong(field_name: "id") @fetchable(field_name: "id") {
  id: ID!
  text: String
  photo_url: String
}
```

**Use Cases**

- Refetching, cache eviction, and optimistic-update tooling may re-resolve a
  `@fetchable` object on its own, rather than re-running the original operation.
- Batch loaders may use `multifetch__<Type>` to resolve many objects of a type in
  a single round trip.
- Code generators may emit refetch queries only for the types that declare
  fetchability.

With the above example, having read a `PhotoStory`'s `id` in an earlier response,
we can re-resolve just that story without replaying the original query:

```graphql
query RefetchPhotoStory($id: ID!) {
  fetch__PhotoStory(id: $id) {
    id
    photo_url
  }
}
```

To re-resolve many stories at once, `multifetch__PhotoStory` returns one edge per
requested id, in the same order and with the same length as the input list. Each
edge's `node_id` echoes the requested id (and equals `node`'s
`@fetchable(field_name:)` value when resolved), so results can be correlated back
to the requested ids even when a `node` is {null}:

```graphql
query RefetchPhotoStories($ids: [ID!]!) {
  multifetch__PhotoStory(ids: $ids) {
    node_id
    node {
      photo_url
    }
  }
}
```

## Relationship to @strong

When using `@strong` every `@fetchable` type must also be `@strong`. The `@fetchable(field_name:)`
need not match the `@strong(field_name:)`: identity (used for merging objects in
a normalized cache) and fetchability (used for re-resolution) may be backed by
different fields. This is useful, for example, when a small hashed field is used
for identity while a separate, larger token field is required to fetch the
object.

## Generated root fields

For each `@fetchable` type `<Type>`:

- a single-item query field, `Query.fetch__<Type>(id: ID!): <Type>`, exists.
- a multi-item query field,
  `Query.multifetch__<Type>(ids: [ID!]!): [<Type>MultifetchEdge!]!`, exists.
- `type <Type>MultifetchEdge { node: <Type>, node_id: ID! }` exists.

`field_name` is always required. It names the field whose value can be passed to
the generated `Query.fetch__<Type>(id:)` and `Query.multifetch__<Type>(ids:)`
fields to (re-)fetch the object with the exact same _identity_.

`multifetch__<Type>(ids: $ids)` must return exactly one `<Type>MultifetchEdge`
per input `id`, in the same order as the input `ids`: the result list always has
the same length as the input list. For each edge:

- `node` is the resolved `<Type>`, or {null} if the corresponding `id` cannot be
  resolved.
- `node_id` is the `id` from the input list — the original requested key,
  preserved even when `node` is {null}. When `node` is non-null, `node_id` equals
  `node`'s `@fetchable(field_name:)` value.

The nullable `node` within a non-null edge is precisely what lets a caller
correlate every requested `id` to its result — by position and by `node_id` —
even for ids that did not resolve.

## @fetchable on Object types

For Object types, `@fetchable(field_name: "<field>")` is required: the referenced
field must exist and be typed `<field>: ID @semanticNonNull` or `<field>: ID!`.

## @fetchable on Interface types

`field_name` is required on an `@fetchable` interface, just as it is on an
`@fetchable` object. All types implementing an `@fetchable` interface must
themselves be `@fetchable`, but the interface and its implementations each
specify their own `field_name` and _need not_ share the same value.

## New Implementation Recommendations

This specification _matches behavior in existing implementations_: as this
specification is a result of iterative, in-production implementations, it
describes what _is_ rather than what _ought to be_.

If you're creating a new GraphQL implementation, you should, if possible:

- Prefer a single field for both `@strong(field_name:)` and
  `@fetchable(field_name:)` unless a separate fetch token is genuinely required.
- Ensure `Query.fetch__<Type>` and `Query.multifetch__<Type>` are generated
  consistently for every `@fetchable` type, rather than hand-authored.
