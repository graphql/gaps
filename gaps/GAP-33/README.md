# GAP-33: GraphQL Schema Definition Language - Set Extensions

## Overview

This proposal adds syntax to the [GraphQL Type System](https://spec.graphql.org/draft/#sec-Type-System)'s IDL
(sometimes called the "Schema Definition Language" or SDL) to allow for a *syntax* representation
that support set *semantics*. This GAP does not yet define the *behavior* of set operations.

Additionally, a Document using these set-extended semantics is *not* considered a
GraphQL Type System Document, unless it would parse, validly, using the Spec standard Type System syntax.

This is a potential alternative to https://github.com/graphql/gaps/pull/4.

## Motivation

It is common for tooling working with GraphQL to need to compose sets. This can be defined as a "union" operation.
For instance, composite schemas need a merge operation, as defined in the [Composite Schemas Spec](https://graphql.github.io/composite-schemas-spec/draft/#sec-Merge).

Another need is to partially *intersect* schemas. For instance, if we want to know the schema that
is common across two different base schemas, an intersection lets us build products that will work against either.

Another common requirement we've run into is determining whether a schema that an older client builds against
is a *true subset* of the current server schema. We can determine this by using an *exclude* operation.

However, the Type System Document syntax grammar does not support all of these operations well. For instance,
how do you represent
```graphql
type A {
  a(arg: Int): Int
}

type B {
  b: Int @something
}
```
**exclude**
```graphql
type A {
  a: Int
}

extend type B {
  b: Int
}
```

The closest we could get in the current Spec syntax is:
```graphql
extend type A {
  a(arg: Int): Int
}

type B {
  b: Int @something
}
```
Notice that we *do* have syntax, via the `extend` keyword, to showcase that `type A` is excluded from the exclude-set.
But we don't have any syntax to show that `A.a` is excluded but `A.a(arg:)` is not.

Likewise we can show that `type B` is *not* excluded, but we have no way of showing that the field, `B.b`, IS excluded, but the directive, `@something`, on `B.b` is NOT excluded.
