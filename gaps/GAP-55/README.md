# GAP-55: Identity: @fetchable

> [!NOTE]
> This proposal has a companion: **Identity: @strong**
> ([GAP-54](../GAP-54/README.md)), which `@fetchable` builds on.

## Overview

This proposal defines the **`@fetchable`** schema directive, which declares that
a type can be independently (re-)fetched from a type-specific root field given a
field value that identifies it.

`@fetchable` builds on the companion **`@strong`** directive (see
[Identity: @strong](../GAP-54/README.md)): every `@fetchable` type must also be
`@strong`, though the two directives need not reference the same field — identity
and fetchability may be backed by different fields.

For a `@fetchable` type `Type`, the schema guarantees generated root fields:

- `Query.fetch__Type(id: ID!): Type` — single-item fetch
- `Query.multifetch__Type(ids: [ID!]!): [TypeMultifetchEdge!]!` — batch fetch
- `type TypeMultifetchEdge { node: Type, node_id: ID! }`

Given the schema:
```
type User @strong(field_name: "id") @fetchable(field_name: "key") {
  id: ID!
  key: ID!
}

type Query {
  fetch__User(id: ID!): User
  multifetch__User(ids: [ID!]!): [UserMultifetchEdge!]!
}

type UserMultifetchEdge {
  node: User
  node_id: ID!
}
```

and a `User.key` value, `@fetchable` guarantees that the following query will always produce the same response when provided the same `$key`:

```
query FetchUser($key: ID!) {
  fetch__User(id: $key) {
    id
    key
  }
}
```
While `User.id` may be different from `User.key`, both values must stay consistent across requests.

## Motivation

This proposal documents how `@fetchable` is already defined and used, in
production. `@fetchable` exists to let a client re-resolve a single object on its
own — for refetching, cache eviction, pagination repair, and optimistic-update
rollback — without replaying the operation that originally produced it.

`@fetchable` builds directly on [`@strong`](../GAP-54/README.md), and the two
divide a single concern that [Global Object Identification](https://relay.dev/graphql/objectidentification.htm)
conflates. Identity (`@strong`) tells a client *whether two values are the same
entity*; fetchability (`@fetchable`) tells it *how to retrieve that entity
again*. The Global Object Identification spec couples both into one `id` field
resolved through a single `node(id:)` root field, which carries three costs
`@fetchable` avoids:

- **Service resolution cost**: A single polymorphic `node(id:)` must dispatch across
  every `Node` type, which is often slower and harder to optimize than a
  type-specific root field. `@fetchable` generates `Query.fetch__<Type>(id:)` and
  `Query.multifetch__<Type>(ids:)`, so each type is fetched through a direct,
  individually optimizable path.
- **Token size**: Because `node(id:)` keys on the same `id` used for identity, an
  object that needs a large retrieval token must carry that token *as* its
  identity, bloating every cache key. `@fetchable` lets identity and retrieval be
  backed by *different* fields — exactly the `id` (identity) versus `key`
  (retrieval) split shown above: a small hashed field can serve as the `@strong`
  identity while a separate, larger token field serves as the `@fetchable` key.
- **Client type resolution**: `Node` is an abstract type, and requires explicit type-discrimination like `... on ActualType { ... }`
  to actually use the value. This risks empty non-null responses when `node` resolves
  to a different type. It also makes schema evolution more challenging: migrating a type from an Object to an Interface
  is difficult when clients rely on a `__typename` field to determine whether the spread underneath `node` is fulfilled.

Because `@fetchable` is per-type and explicit, code generators can emit refetch
queries only for the types that actually declare fetchability, rather than
assuming every `Node` is independently retrievable.

## Relationship to prior art

This is an alternative form of fetchability to the
[Global Object Identification Specification](https://relay.dev/graphql/objectidentification.htm)
(the `Node` interface and `node(id:)` root field).

Related discussions and prior art:

- [Global Object Identification](https://relay.dev/graphql/objectidentification.htm).
- [Apollo Federation entities and `@key`](https://www.apollographql.com/docs/federation/entities/).
- Companion proposal: [Identity: @strong](../GAP-54/README.md).

**Reference implementation.** Relay already carries (partial, partly
undocumented) support for `@fetchable`:

- Relay's directive docs reference it under
  [`@refetchable(..., preferFetchable:)`](https://relay.dev/docs/api-reference/graphql/graphql-directives/):
  the flag makes the compiler "prefer generating `fetch_MyType(): MyType`
  queries … useful for schemas that have adopted the `@strong` and `@fetchable`
  server annotations".
- The `@fetchable(field_name:)` directive is defined in the Relay compiler —
  [`compiler/crates/schema/src/flatbuffer.rs`](https://github.com/facebook/relay/blob/main/compiler/crates/schema/src/flatbuffer.rs).
- Relay generates per-type fetch queries from `@fetchable` via
  [`fetchable_query_generator.rs`](https://github.com/facebook/relay/blob/main/compiler/crates/relay-transforms/src/refetchable_fragment/fetchable_query_generator.rs).
- `@fetchable` on interfaces is shown in the
  [Relay 15 release notes](https://relay.dev/blog/2023/03/30/relay-15/).

## Status

**Proposal.** Initial draft; not yet sponsored.

## Challenges and drawbacks

`@fetchable` inherits the adoption caveats of [`@strong`](../GAP-54/README.md),
and adds a few of its own.

**Generated field naming and collisions**: `@fetchable` reserves the
`fetch__<Type>`, `multifetch__<Type>`, and `<Type>MultifetchEdge` names. The
embedded `__` is the convention that keeps these from colliding with
user-authored fields (which must not contain `__`), but the prefix is not
configurable in this spec, and an implementation must still guard against
collisions between generated names and any other generated or hand-authored
schema element.

**Two identity-like fields to keep in sync**: allowing
`@fetchable(field_name:)` to differ from `@strong(field_name:)` means a type can have
two related-but-distinct fields to represent identity.
Prefer a single field for both unless a separate fetch token is genuinely
required.

**The `MultifetchEdge` wrapper**: `multifetch__<Type>` returns a wrapper edge
type (`{ node, node_id }`) rather than a plain `[<Type>]`, purely so an
unresolved `id` can be correlated back to its request by position and by
`node_id`. This is extra schema surface, and the nullability of `node` versus
`node_id` is subtle: `node` may be {null} for an id that does not resolve, while
`node_id` always echoes the requested id. Implementations that support nullable
list items could express this without the wrapper, but the wrapper is required if
your client cannot include null list items: you don't want to compact out null edges
and end up with differently-sized input and output lists.

**Fetchable interfaces with divergent `field_name`s**: an `@fetchable` interface
and each of its implementations may declare *different* `field_name`s. It's important
not to assume we can use the *concrete type's* fetchable field with the *interface*'s root fetch field.

For instance with:
```
interface Animal @fetchable(field_name: "animal_id") {
  name: String
  animal_id: ID!
}

type Dog implements Animal @fetchable(field_name: "id") {
  name: String
  id: ID!
  animal_id: ID!
}

type Query {
  fetch__Animal(id: ID!): Animal
  fetch__Dog(id: ID!): Dog
  random_animal: Animal!
}
```
If we try to get a Dog by passing the `animal_id` from `Query.random_animal.animal_id` in an operation like:
```
query FetchDog($id: ID!) {
  fetch__Dog(id: $id) {
    name
    id
  }
}
```
we cannot guarantee the `Query.fetch__Dog` field can resolve based on the `animal_id`.

Instead, we must use `Query.fetch__Animal` when passing an `Animal.animal_id` or `Dog.animal_id`,
but we can specifically request a `Dog` response with `Query.fetch__Dog` via a `Dog.id`.
