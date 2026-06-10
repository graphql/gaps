# GAP-54: Identity: @strong

> [!NOTE]
> This is a scaffold. Sections marked _TODO_ still need to be written.
>
> This proposal has a companion: **Identity: @fetchable**
> ([GAP-55](../GAP-55/README.md)), which builds on `@strong`.

## Overview

This proposal defines the **`@strong`** schema directive, which marks a type as
having a _strong identity_: an identifier that is unique across all values of the
same type, such that any two values sharing that identity denote the same entity,
wherever they appear in a response.

It also defines a `strong_id__: ID` meta-field on every type. For `@strong`
types, `strong_id__` is semantically non-null and, combined with `__typename`,
forms a globally unique value.

`@strong` is the foundation for the companion **`@fetchable`** directive (see
[Identity: @fetchable](../GAP-55/README.md)): a type must be `@strong` before it
can be `@fetchable`.

## Motivation

This proposal documents how `@strong` is already defined and used, in production.
`@strong` enabled Meta to solve specific performance and behavioral issues, and at the time
acted as a foundation for more advanced features.

Specifically, `@strong` enabled production schemas to safely evolve while preserving
long-lived, compiled clients' store behavior, in a way that was not possible with [Global Object Identification](https://relay.dev/graphql/objectidentification.htm).

The Global Object Identification Spec conflates *identity* with an object's *retrieval token*.

If an object is ephemeral and not retrievable from the service, there is either no way to retrieve the object via `node(id: $id)`, or the `id` must encode the entirety of the object's data. In practice,
this led to either producing `id` values that were kilobytes in size, or failing to fulfill the
[Global Object Identification Spec](https://relay.dev/graphql/objectidentification.htm) by having types that
implement `Node` but return responses with `"id": null`.

The key insight for `@strong` was that we needed a single meta-field, `strong_id__: ID`, that can be requested within *any* selection set, which does *not* guarantee we can retrieve the same object from the service. We need to be able to request `strong_id__` on *abstract* (Union and Interface) type selections. Unions and Interfaces may mix strong and weak types, and we want to ensure that strong values are always consistent.

`strong_id__` allows clients using a consistent, normalized store to:
- Always request a single field, and know whether to treat a given object in the response as "strong" or "weak" based on whether `strong_id__` is null or not.
- If `strong_id__` is always requested, weak objects (say, an Address type), can become `@strong`, and get a consistency "fix" on old clients.
- For objects that have large retrieval keys, storing the retrieval key as the *key in the store* can cause performance degradation on store publish and lookups.
  - If the `id` field is incredibly large, we can create a new field, `cache_id`, that is a one-way hash of `id`'s value.
  - By migrating from `type HasLargeKey @strong(field_name: "id")` to `type HasLargeKey @strong(field_name: "cache_id")`, we can ship the new more-performant keys to existing clients using `strong_id__`, provided the client does not treat `strong_id__` as an alias for `id`, or vice versa.

## Relationship to prior art

This is an alternative form of identity to the
[Global Object Identification Specification](https://relay.dev/graphql/objectidentification.htm)
(the `Node` interface and `node(id:)` root field).

Related discussions and prior art:

- [Global Object Identification](https://relay.dev/graphql/objectidentification.htm).
- [Apollo Federation entities and `@key`](https://www.apollographql.com/docs/federation/entities/).
- Companion proposal: [Identity: @fetchable](../GAP-55/README.md).

## Status

**Proposal.** Initial draft; not yet sponsored.

## Challenges and drawbacks

`@strong` has some thorny issues that require thoughtful adoption.

**Reader Confusion**: When people see an `id: ID!` field in a selection set, they tend to assume that's the field that will return a retrievable, global identity. `@strong` upends that: it may be true in almost all cases, but if there is any divergence it will typically be for your *most important* cases. If you *can* make `id` the cheap identity field for every object in your schema, you should, whether or not you adopt `@strong`.

**Non-global identity**: `@strong` does not *require* an object's `strong_id__` be globally unique.
In practice, this means clients need to request another field, such as `__typename`, which is merged
with `strong_id__` to create the object's key for the client normalized store.

The reason to *not* make `strong_id__` a hash of `__typename` and `field_name:` was specifically so that `strong_id__` and the `field_name:` could
be considered the same value. In retrospect, this is dangerous behavior to rely on, as described below.

**Using `strong_id__` as the value for `id` lookups is not safe for schema evolution**:
Even if a type is `@strong(field_name: "id")`, while it is extremely tempting for performance reasons, it is not safe to de-duplicate the `id` and `strong_id__` in the selection set: the `field_name` may change over time, and if `id` is used for the purpose of making a follow-up query, `strong_id__` is not guaranteed to match forever into the future.

If you de-duplicate the `<field_name>` and `strong_id__`, or use `strong_id__` for client logic,
it becomes a breaking change for your existing clients to change the `field_name:` value.

**Treating a `"strong_id__": null` as a single shared object**:
It is easy to assume that, whenever you see a `strong_id__` field, that it will have a non-null value.
The `@strong` spec *specifically* allows for `null` values for weak, non-identifiable object types.

For a query like:
```
query {
  __typename
  strong_id__
  node(id: 123) {
    __typename
    strong_id__
    ... on User {
      address {
        __typename
        strong_id__
        street
      }
    }
  }
}
```
with a response like:
```
{
  "data": {
    "__typename": "Query",
    "strong_id__": "Query",
    "node": {
      "__typename": "User",
      "strong_id__": "123",
      "address": {
        "__typename": "Address",
        "strong_id__": null,
        "street": "Hacker Way"
      }
    }
  }
}
```

The client consistency store should probably look something like:
```
{
  "Query:Query": {
    "node(id:123)": "User:123"
  },
  "User:123": {
    "address": {
      "street": "Hacker Way"
    }
  }
}
```

As the `Address` type is a weak object, it can't have an identity independent of the parent strong `User`.

Note in this example, `Query` has an identity: it's extremely convenient to treat every instance of the `Query` type as a single, shared `@strong` type.
Similarly, it may be convenient for the other root types, `Mutation` and `Subscription`, to each have a singular identity value.
