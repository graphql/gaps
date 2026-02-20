## Problem statement

The current GraphQL specification allows type system extensions.

For example, it is possible to add directives to an existing type. In this example (from the specification text), a directive is added to a User type without adding fields:

```graphql
extend type User @addedDirective
```

The same thing is not possible for fields:

```graphql
# This is not valid GraphQL
extend type User {
  id: ID! @key
}
```

This has been an ongoing pain point when working in clients that do not own the schema but want to annotate it for codegen or other reasons. In Apollo Kotlin, this has led to the proliferation of directives ending in \*Field whose only goal is to work around that limitation. For an example, this is happening in the nullability directives:

```graphql
# This can be added to a field definition directly
directive @semanticNonNull(levels: [Int!]! = [0]) on FIELD_DEFINITION
```

```graphql
# This is the same thing but on the containing type.
# It is more verbose and cumbersome to write and maintain
directive @semanticNonNullField(
  name: String!
  levels: [Int!]! = [0]
) repeatable on OBJECT | INTERFACE
```

## Overview

This GAP builds on the current ability to extend types and further allows extending existing fields.

Interface type extensions may extend existing fields.

In this example, we deprecate the field `id` on type `Query` by adding a
`@deprecated` directive:

```graphql example
type Query {
  id: ID
}
```

```graphql example
extend type Query {
  id: ID @deprecated(reason: "Use globalId instead")
}
```

For each field of an Object type extension:

1.  The field must have a unique name within that 2. If a field with the same name exists on the previous Object type:
    type extension; no
    two fields may share the same name.
2.  If a field with the same name exists on the previous Object type:
    1. The field type must match the previous definition exactly.
    2. The field description must match the previous definition exactly.
    3. Any non-repeatable directives provided must not already apply to the
       previous definition.
    4. For each argument of the field:
       1. If an argument with the same name exists on the previous field
          definition:
          1. The argument type must match the previous definition exactly.
          2. If the argument has a default value, it must match the previous
             definition exactly or not be added.
          3. The argument description must match the previous definition
             exactly or not be added.
          4. Any non-repeatable directives provided must not already apply to
             the previous definition.
