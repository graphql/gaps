# Set Extensions for Type System Documents

This document specifics an alternative to the [Type System Document](https://spec.graphql.org/draft/#sec-Type-System) for defining a set-compatible version of the type system of a GraphQL Schema.

It is common to need to treat schema documents as sets: we may want
to merge two documents to create a "Composite Schema", or you might
want to know the intersection between documents to build
products that work against all the provided GraphQL Services.

Any grammar not defined, but used, in this document is a reference
to the grammar defined in [the GraphQL Specification's Grammar](https://spec.graphql.org/draft/#sec-Appendix-Grammar-Summary).

The key change to the grammar: **every location in the schema that can have a directive now can also be an Extension**.

To put it another way, if a location in the Schema can be defined by a
[Schema Coordinate](https://spec.graphql.org/draft/#sec-Schema-Coordinates), then it can exist in the Set Type System in an `extend` representation. Additionally, the root `schema` has an `extend` representation, because it can apply set operations.

# Set Type System

SetTypeSystemDocument : SetTypeSystemDefinitionOrExtension+

SetTypeSystemDefinitionOrExtension :

- SetTypeSystemDefinition
- SetTypeSystemExtension

SetTypeSystemDefinition :

- SetSchemaDefinition
- SetTypeDefinition
- SetDirectiveDefinition

SetTypeSystemExtension :

- SetSchemaExtension
- SetTypeExtension
- SetDirectiveExtension

## Schema

SetSchemaDefinition : Description? schema Directives[Const]? {
RootOperationTypeDefinition+ }

RootOperationTypeDefinition : OperationType : NamedType

### Schema Extension

SetSchemaExtension :

- extend schema Directives[Const]? { RootOperationTypeDefinition+ }
- extend schema Directives[Const] [lookahead != `{`]

SetSchemaDefinition and SetSchemaExtension are grammatically identical to the [Schema](https://spec.graphql.org/draft/#sec-Schema) in the GraphQL Specification.

## Types

SetTypeDefinition :

- SetScalarTypeDefinition
- SetObjectTypeDefinition
- SetInterfaceTypeDefinition
- SetUnionTypeDefinition
- SetEnumTypeDefinition
- SetInputObjectTypeDefinition

### Type Extensions

SetTypeExtension :

- SetScalarTypeExtension
- SetObjectTypeExtension
- SetInterfaceTypeExtension
- SetUnionTypeExtension
- SetEnumTypeExtension
- SetInputObjectTypeExtension

## Scalars

SetScalarTypeDefinition : Description? scalar Name Directives[Const]?

SetScalarTypeDefinition and SetScalarTypeExtension are gramatically identical to the [Scalars](https://spec.graphql.org/draft/#sec-Scalars) Specification.

### Scalar Extensions

SetScalarTypeExtension :

- extend scalar Name Directives[Const]

## Objects

SetObjectTypeDefinition :

- Description? type Name ImplementsInterfaces? Directives[Const]?
  SetFieldsDefinitionOrExtension
- Description? type Name ImplementsInterfaces? Directives[Const]? [lookahead !=
  `{`]

ImplementsInterfaces :

- ImplementsInterfaces & NamedType
- implements `&`? NamedType

SetFieldsDefinitionOrExtension : { SetFieldDefinitionOrExtension+ }

### Object Extensions

SetObjectTypeExtension :

- extend type Name ImplementsInterfaces? Directives[Const]? SetFieldsDefinitionOrExtension
- extend type Name ImplementsInterfaces? Directives[Const] [lookahead != `{`]
- extend type Name ImplementsInterfaces [lookahead != `{`]

## Fields

SetFieldDefinitionOrExtension:

- SetFieldDefinition
- SetFieldExtension

SetFieldDefinition :
- Description? Name SetArgumentsDefinitionOrExtension? : Type Directives[Const]?
- Description? Name SetArgumentsDefinitionOrExtension [lookahead != `:`] Directives[Const]?
- Description? Name [lookahead != `:`] Directives[Const]?

### Field Extensions

SetFieldExtension :
- extend Name SetArgumentsDefinitionOrExtension? : Type Directives[Const]?
- extend Name SetArgumentsDefinitionOrExtension [lookahead != `:`] Directives[Const]?
- extend Name [lookahead != `:`] Directives[Const]?

It is possible for the type definition of a field to only be present in that field's extension. Likewise, we need to be able to extend a field (like deprecating it)
with a guarantee that the field's type will not change through the extension.

Field extensions are different from fields defined by a type extension. The below is valid syntax:

```graphql field-extension
extend type Person {
  extend age @deprecated
  name
}

type Business {
  extend name @deprecated
}
```
To become a valid GraphQL Spec document, the above would need to
be `union`'d with a document like:

```graphql field-extension-merge
type Person {
  age: Int
  extend name: String @deprecated
}

extend type Business {
  name: String
}
```

resulting in:

```graphql field-extension-union
type Person {
  age: Int @deprecated
  name: String @deprecated
}

type Business {
  name: String @deprecated
}
```
which is now a valid GraphQL Type System Document.

The syntax of allowing field definitions without a type definition
enables tooling, such as diff tools, to have a valid *syntax* for
how a schema is evolving, even if the *semantic meaning* of the syntax
would not produce a valid GraphQL Schema.

### Field Arguments

SetArgumentsDefinition : ( SetInputValueDefinitionOrExtension+ )

SetInputValueDefinitionOrExtension :
- SetInputValueDefinition
- SetInputValueExtension

### Input Values

SetInputValueDefinition :

- Description? Name : Type DefaultValue? Directives[Const]?
- Description? Name [lookahead != `:`] DefaultValue? Directives[Const]?

### Input Value Extensions

SetInputValueExtension :

- extend Name : Type Directives[Const]?
- extend Name [lookahead != `:`] Directives[Const]?

Similar to Field Definitions and Extensions, Input Value Definitions and Extensions cannot may elide the input value's type.

Example:
```graphql argument-extension
type Person {
  name(short): String
  extend age(minimum: Int)
}
```
union
```graphql argument-extension-union
type Person {
  extend name(extend short: Boolean)
  age(extend minimum @deprecated): Int
}
```
results in:
```
type Person {
  name(short: Boolean): String
  age(minimum @deprecated): Int
}
```

SetInterfaceTypeDefinition :

- Description? interface Name ImplementsInterfaces? Directives[Const]?
  SetFieldsDefinitionOrExtension
- Description? interface Name ImplementsInterfaces? Directives[Const]?
  [lookahead != `{`]

SetInterfaceTypeExtension :

- extend interface Name ImplementsInterfaces? Directives[Const]?
  SetFieldsDefinitionOrExtension
- extend interface Name ImplementsInterfaces? Directives[Const] [lookahead !=
  `{`]
- extend interface Name ImplementsInterfaces [lookahead != `{`]

## Unions

SetUnionTypeDefinition : Description? union Name Directives[Const]?
UnionMemberTypes?

UnionMemberTypes :

- UnionMemberTypes | NamedType
- = `|`? NamedType

### Union Extensions

SetUnionTypeExtension :

- extend union Name Directives[Const]? UnionMemberTypes
- extend union Name Directives[Const]

SetUntionTypeExtension is gramatically identical to the [Unions](https://spec.graphql.org/draft/#sec-Unions) in the GraphQL Specification.

## Enums

SetEnumTypeDefinition :

- Description? enum Name Directives[Const]? SetEnumValuesDefinitionOrExtension
- Description? enum Name Directives[Const]? [lookahead != `{`]

### Enum Values

SetEnumValuesDefinitionOrExtension : { SetEnumValueDefinitionOrExtension+ }

SetEnumValueDefinitionOrExtension :
- SetEnumValueDefinition
- SetEnumValueExtension

SetEnumValueDefinition : Description? EnumValue Directives[Const]?
SetEnumValueExtension : extend EnumValue Directives[Const]?

### Enum Extensions

SetEnumTypeExtension :

- extend enum Name Directives[Const]? SetEnumValuesDefinitionOrExtension
- extend enum Name Directives[Const] [lookahead != `{`]

## Input Objects

InputObjectTypeDefinition :

- Description? input Name Directives[Const]? SetInputFieldsDefinitionOrExtension
- Description? input Name Directives[Const]? [lookahead != `{`]

SetInputFieldsDefinitionOrExtension : { SetInputValueDefinitionOrExtension+ }

## Input Object Extensions

InputObjectTypeExtension :

- extend input Name Directives[Const]? SetInputFieldsDefinitionOrExtension
- extend input Name Directives[Const] [lookahead != `{`]

## Directives

NOTE: we are assuming that directives on directive definitions, (https://github.com/graphql/graphql-spec/pull/1206) is in the spec at this point.

SetDirectiveDefinition : Description? directive @ Name SetArgumentsDefinitionOrExtension? Directives[Const]?
`repeatable`? on DirectiveLocations

DirectiveLocations :

- DirectiveLocations | DirectiveLocation
- `|`? DirectiveLocation

DirectiveLocation :

- ExecutableDirectiveLocation
- TypeSystemDirectiveLocation

ExecutableDirectiveLocation : one of

- `QUERY`
- `MUTATION`
- `SUBSCRIPTION`
- `FIELD`
- `FRAGMENT_DEFINITION`
- `FRAGMENT_SPREAD`
- `INLINE_FRAGMENT`
- `VARIABLE_DEFINITION`

TypeSystemDirectiveLocation : one of

- `SCHEMA`
- `SCALAR`
- `OBJECT`
- `FIELD_DEFINITION`
- `ARGUMENT_DEFINITION`
- `INTERFACE`
- `UNION`
- `ENUM`
- `ENUM_VALUE`
- `INPUT_OBJECT`
- `INPUT_FIELD_DEFINITION`
- `DIRECTIVE_DEFINITION`

### Directive Extensions

SetDirectiveExtension : extend directive @ Name SetArgumentsDefinitionOrExtension? Directives[Const]

# Set Operations

With the provided syntax, we can create set operations
- `union`, or ∪⁠ (also known as **merge** or **set addition**). `union` is associative and commutative, much like addition.
- `intersect`, or ∩.
- `exclude`, or \, or - (also known as **difference** or **set subtraction**). `exclude` is neither associative nor commutative, much like subtraction.

## Union

```graphql
type A implements X {
  field(arg: Int): String
}
```
`union`
```graphql
type A @directive {
  field(arg: Int!): String!
}
```
will result in:
```
type A implements X @directive {
  field(arg: Int!): String
}
```

If a union could not possibly be commutative, i.e. the *order* of set union would affect the result,
then the `union` operation should return a `UnionError`. The type of `A.field` below cannot be  determined.
```
type A {
  field: Int!
}
```
`union`
```
type A {
  field: String!
}
```


## Exclude

## Intersect

`A intersect B = A exclude (A exclude B)`.

`intersect` is defined by the application of `exclude`.

# Appendix: Grammar Summary

SetTypeSystemExtensionDocument : SetTypeSystemDefinitionOrExtension+

SetTypeSystemDefinitionOrExtension :

- SetTypeSystemDefinition
- SetTypeSystemExtension

SetTypeSystemExtension :

- SetSchemaExtension
- SetTypeExtension

SetSchemaDefinition : Description? schema Directives[Const]? {
RootOperationTypeDefinition+ }

SetSchemaExtension :

- extend schema Directives[Const]? { RootOperationTypeDefinition+ }
- extend schema Directives[Const] [lookahead != `{`]

RootOperationTypeDefinition : OperationType : NamedType

SetTypeDefinition :

- SetScalarTypeDefinition
- SetObjectTypeDefinition
- SetInterfaceTypeDefinition
- SetUnionTypeDefinition
- SetEnumTypeDefinition
- SetInputObjectTypeDefinition

SetTypeExtension :

- SetScalarTypeExtension
- SetObjectTypeExtension
- SetInterfaceTypeExtension
- SetUnionTypeExtension
- SetEnumTypeExtension
- SetInputObjectTypeExtension

SetScalarTypeDefinition : Description? scalar Name Directives[Const]?

SetScalarTypeExtension :

- extend scalar Name Directives[Const]

SetObjectTypeDefinition :

- Description? type Name ImplementsInterfaces? Directives[Const]? SetFieldsDefinitionOrExtension
- Description? type Name ImplementsInterfaces? Directives[Const]? [lookahead != `{`]

SetObjectTypeExtension :

- extend type Name ImplementsInterfaces? Directives[Const]? SetFieldsDefinitionOrExtension
- extend type Name ImplementsInterfaces? Directives[Const] [lookahead != `{`]
- extend type Name ImplementsInterfaces [lookahead != `{`]

ImplementsInterfaces :

- ImplementsInterfaces & NamedType
- implements `&`? NamedType

SetFieldsDefinitionOrExtension : { SetFieldDefinitionOrExtension+ }

SetFieldDefinitionOrExtension :
- SetFieldDefinition
- SetFieldExtension

SetFieldDefinition :
- Description? Name SetArgumentsDefinitionOrExtension? : Type Directives[Const]?
- Description? Name SetArgumentsDefinitionOrExtension [lookahead != `:`] Directives[Const]?
- Description? Name [lookahead != `:`] Directives[Const]?

SetFieldExtension :
- extend Name SetArgumentsDefinitionOrExtension? : Type Directives[Const]?
- extend Name SetArgumentsDefinitionOrExtension [lookahead != `:`] Directives[Const]?
- extend Name [lookahead != `:`] Directives[Const]?

SetArgumentsDefinitionOrExtension : ( SetInputValueDefinitionOrExtension+ )

SetInputValueDefinitionOrExtension :
- SetInputValueDefinition
- SetInputValueExtension

SetInputValueDefinition :
- Description? Name : Type DefaultValue? Directives[Const]?
- Description? Name [lookahead != `:`] Directives[Const]?

SetInputValueExtension :
- extend Name : Type DefaultValue? Directives[Const]?
- extend Name [lookahead != `:`] Directives[Const]?

SetInterfaceTypeDefinition :

- Description? interface Name ImplementsInterfaces? Directives[Const]? SetFieldsDefinitionOrExtension
- Description? interface Name ImplementsInterfaces? Directives[Const]? [lookahead != `{`]

SetInterfaceTypeExtension :

- extend interface Name ImplementsInterfaces? Directives[Const]? SetFieldsDefinitionOrExtension
- extend interface Name ImplementsInterfaces? Directives[Const] [lookahead != `{`]
- extend interface Name ImplementsInterfaces [lookahead != `{`]

SetUnionTypeDefinition : Description? union Name Directives[Const]?
UnionMemberTypes?

UnionMemberTypes :

- UnionMemberTypes | NamedType
- = `|`? NamedType

SetUnionTypeExtension :

- extend union Name Directives[Const]? UnionMemberTypes
- extend union Name Directives[Const]

SetEnumTypeDefinition :

- Description? enum Name Directives[Const]? SetEnumValuesDefinitionsOrExtension
- Description? enum Name Directives[Const]? [lookahead != `{`]

SetEnumValuesDefinitionOrExtension : { SetEnumValueDefinitionOrExtension+ }

SetEnumValueDefinitionOrExtension:
- SetEnumValueDefinition
- SetEnumValueExtension

SetEnumValueDefinition : Description? EnumValue Directives[Const]?

SetEnumValueExtension : extend EnumValue Directives[Const]?

SetEnumTypeExtension :

- extend enum Name Directives[Const]? SetEnumValuesDefinitionsOrExtension
- extend enum Name Directives[Const] [lookahead != `{`]

SetInputObjectTypeDefinition :

- Description? input Name Directives[Const]? SetInputFieldsDefinition
- Description? input Name Directives[Const]? [lookahead != `{`]

SetInputFieldsDefinition : { SetInputFieldsDefinitionOrExtension+ }

SetInputObjectTypeExtension :

- extend input Name Directives[Const]? SetInputFieldsDefinition
- extend input Name Directives[Const] [lookahead != `{`]

SetDirectiveDefinition : Description? directive @ Name SetArgumentsDefinitionOrExtension?
`repeatable`? on DirectiveLocations

DirectiveLocations :

- DirectiveLocations | DirectiveLocation
- `|`? DirectiveLocation

DirectiveLocation :

- ExecutableDirectiveLocation
- TypeSystemDirectiveLocation

ExecutableDirectiveLocation : one of

- `QUERY`
- `MUTATION`
- `SUBSCRIPTION`
- `FIELD`
- `FRAGMENT_DEFINITION`
- `FRAGMENT_SPREAD`
- `INLINE_FRAGMENT`
- `VARIABLE_DEFINITION`

TypeSystemDirectiveLocation : one of

- `SCHEMA`
- `SCALAR`
- `OBJECT`
- `FIELD_DEFINITION`
- `ARGUMENT_DEFINITION`
- `INTERFACE`
- `UNION`
- `ENUM`
- `ENUM_VALUE`
- `INPUT_OBJECT`
- `INPUT_FIELD_DEFINITION`
- `DIRECTIVE_DEFINITION`

SetDirectiveExtension : extend directive @ Name SetArgumentsDefinitionOrExtension? Directives[Const]
