## Overview

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
