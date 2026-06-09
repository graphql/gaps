# Identity: @strong

> [!NOTE]
> This is one of a pair of companion proposals. **Identity: @fetchable**
> ([GAP-55](../GAP-55/README.md)) builds on `@strong` to
> describe types that can be independently (re-)fetched given their identity. The
> two are designed to be read together but may be adopted independently.

```
directive @strong(field_name: String) on OBJECT | INTERFACE
```

## Introduction

:: This document specifies the `@strong` schema directive, which marks a type as
having a _strong identity_: an identifier that is unique across all values of the
same type, such that any two values of the type that share that identity denote
the same entity, wherever they appear in a response.

GraphQL responses frequently describe the same underlying entity in more than one
place — the same user as the `author` of a post and as a `friend` of the viewer,
for example. Whether two such positions denote the _same_ entity is information
that clients today must infer from convention (an `id` field, the `Node`
interface, a Federation `@key`).

`@strong` makes that explicit: two values of a `@strong` type that share the same
identity are the same entity, wherever they appear.

Additionally, we add a meta-field to _all_ types, `strong_id__: ID`. When a type
is `@strong`, `strong_id__` is `@semanticNonNull`. If `@strong(field_name: <field>)`
is specified, then `strong_id__` returns the same value as `<Type>.<field>`.

This is an alternative form of identity to the
[Global Object Identification Specification](https://relay.dev/graphql/objectidentification.htm).
In particular, `@strong` is particularly useful when:

- You cannot guarantee globally unique IDs for all objects in the schema.
- You have already created an expensive or non-identifying `id` field that you
  cannot migrate away from.
- You need to have transient elements with an identity that cannot be reliably
  fetched.
- You need to be able to migrate types from being weak, without a known identity,
  to strong, with a specified identity.
- You need to be able to request a _potential_ identity, to ensure abstract types
  with mixed strong and weak implementations merge across requests correctly
  within a normalized cache.

The companion `@fetchable` directive (see
[Identity: @fetchable](../GAP-55/README.md)) builds on `@strong` to describe how
a strong identity can be used to (re-)fetch an object from a type-specific root
field.

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

# `PhotoStory` has a strong identity backed by its `id` field.
type PhotoStory @strong(field_name: "id") {
  id: ID!
  text: String
  photo_url: String
}
```

**Use Cases**

- Normalized client caches may merge and deduplicate objects of a `@strong` type
  by identity, and may store them in a single canonical location.
- Abstract types with mixed strong and weak implementations may request the
  `strong_id__` meta-field to merge correctly across requests.
- Code generators may emit identity-aware types (e.g. cache keys) only for the
  types that declare identity.

With the above example, if we want to write a query that guarantees we can de-duplicate
stories across responses, we might have:
```graphql
query UserStories {
  user {
    strong_id__
    stories {
      strong_id__

      ... on PhotoStory {
        id
        photo_url
      }
    }
  }
}
```
Even though the identity field for `PhotoStory` and `EphemeralStory` are different,
because `Story` is `@strong` we know we can create a key-value store of all Story instances using just `strong_id__` as the key.

## The strong_id\_\_ meta-field

A `strong_id__: ID` meta-field is available on every type.

- If a type is `@strong`, `strong_id__` must be either `strong_id__: ID @semanticNonNull` or `strong_id__: ID!`.
- `<__typename> + strong_id__` forms a globally unique value.
- If a type is not `@strong`, `strong_id__` is `ID` and is always {null}.
- If `@strong(field_name: "<field>")` is specified, `strong_id__` returns the same
  value as `<Type>.<field>`.

## @strong on Object types

For Object types, `@strong(field_name: "<field>")` is non-nullable: the referenced field
must exist and be typed `<field>: ID @semanticNonNull` or `<field>: ID!`.

## @strong on Interface types

For Interface types, `@strong(field_name: "<field>")` is optional. If provided, the referenced field
must exist and be typed `<field>: ID @semanticNonNull` or `<field>: ID!`.

- All types implementing an `@strong` interface must themselves be `@strong`.
- All types implementing an interface with `@strong(field_name: "<field>")` set must
  provide the same value `@strong(field_name: "<field>")` value.


## New Implementation Recommendations

This specification _matches behavior in existing implementations_: as this specification is
a result of iterative, in-production implementations, it describes what _is_
rather than what _ought to be_.

If you're creating a new GraphQL implementation, you should, if possible:
- Ensure the `@strong(field_name:)` is guaranteed to be a globally-unique value.
- Otherwise, ensure via automation or validation, that `__typename` is fetched wherever necessary to ensure globally-unique identity values can be created.
- Always fetch `strong_id__` on all abstract selection sets, i.e. underneath Union or Interface fields, in order to ensure every
  instance of a given concrete Object can be merged, regardless of whether it's fetched underneath a Concrete or Abstract field.
  - A non-`@strong` Interface or Union may include `@strong` Object types, which is why `strong_id__` is available as a nullable meta-field on *all* types.
