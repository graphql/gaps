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

<!-- TODO: Explain the problem `@strong` solves. Sketch:
  - Clients today infer identity from conventions (an `id` field, the `Node`
    interface, etc.). These conventions are implicit and inconsistent.
  - Normalized caches need to know *which* types are safe to merge by identity
    and *which* field constitutes that identity.
  - Globally unique IDs aren't always achievable; per-type identity is.
  - `@strong` makes identity explicit and supports migrating weak types to strong.
-->

_TODO._

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

<!-- TODO: Enumerate open questions and trade-offs. Sketch:
  - Precise resolution/validation of the `strong_id__` meta-field.
  - Type system locations (OBJECT, INTERFACE; UNION?).
  - Interface inheritance of identity and `field_name`.
  - Backwards compatibility with `Node` and Federation `@key`.
-->

_TODO._
