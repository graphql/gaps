# Field extensions

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

But adding directives to an existing field is not possible:

```graphql
directive @semanticNonNull on FIELD_DEFINITION

type User {
  email: String
  #...
}

extend type User {
  # This is not valid GraphQL
  email: String @semanticNonNull 
}
```

Similarly, it's not possible to deprecate a field in a type system extension:

```graphql
extend type User {
  # This is not valid GraphQL
  email: String @semanticNonNull @deprecated("Use primaryEmail instead") 
}
```

This proposal makes it possible to add new directives to an existing field.

## Overview

This GAP builds on the current ability to extend types and further allows adding directives to existing fields.

Note: in the spirit of preserving option value, this proposal doesn't say anything about adding new arguments. Adding this would be a natural addition but hasn't had a use-case yet. Anyone interested in this, please open a pull request with your use case.

The resulting operation is a merge. The following SDL:

```graphql
type User {
  email: String
}

extend type User {
  email: String @semanticNonNull @deprecated("Use primaryEmail instead")
}
```

is equivalent to:

```graphql
type User {
  email: String @semanticNonNull @deprecated("Use primaryEmail instead")
}
```

## Type validation

The spec text for object type extension would need a paragraph like so:

```
Object type extensions have the potential to be invalid if incorrectly defined.

1. The named type must already be defined and must be an Object type.
2. For each field of an Object type extension:
   1. The field must have a unique name within that Object type extension; no
      two fields may share the same name.
   2. If a field with the same name exists on the previous Object type:
      1. The field type must match the previous definition exactly.
      2. The field description must match the previous definition exactly.
      3. Any non-repeatable directives provided must not already apply to the
         previous definition.
      4. The arguments must match exactly.
3. Any non-repeatable directives provided must not already apply to the previous Object type.
4. Any interfaces provided must not be already implemented by the previous
   Object type.
5. The resulting extended object type must be a super-set of all interfaces it
   implements.
```

The same validation would be added for interfaces.