# GraphQL Schema Definition Language - Set Extensions

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

TypeSystemDefinition :

- SetSchemaDefinition
- SetTypeDefinition
- SetDirectiveDefinition

SetTypeSystemDefinitionOrExtension :

- SetTypeSystemDefinition
- SetTypeSystemExtension

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

### Scalar Extensions

SetScalarTypeExtension :

- extend scalar Name Directives[Const]

## Objects

SetObjectTypeDefinition :

- Description? type Name ImplementsInterfaces? Directives[Const]?
  SetFieldsDefinitionOrExtension
- Description? type Name ImplementsInterfaces? Directives[Const]? [lookahead !=
  `{`]

SetObjectTypeExtension :

- extend type Name ImplementsInterfaces? Directives[Const]? SetFieldsDefinitionOrExtension
- extend type Name ImplementsInterfaces? Directives[Const] [lookahead != `{`]
- extend type Name ImplementsInterfaces [lookahead != `{`]

ImplementsInterfaces :

- ImplementsInterfaces & NamedType
- implements `&`? NamedType

SetFieldsDefinitionOrExtension : { SetFieldDefinitionOrExtension+ }

## Fields

SetFieldDefinitionOrExtension:

- SetFieldDefinition
- SetFieldExtension

SetFieldDefinition : Description? Name SetArgumentsDefinitionOrExtension? : Type
Directives[Const]?

SetFieldExtension : extend Name SetArgumentsDefinitionOrExtension? Directives[Const]?

Field extensions are different from fields defined by a type extension. The below is valid syntax:

```graphql field-extension
extend type Person {
  name: String
  extend age @deprecated
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
  extend name @deprecated
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

### Field Arguments

SetArgumentsDefinition : ( SetInputValueDefinitionOrExtension+ )

SetInputValueDefinitionOrExtension :
- SetInputValueDefinition
- SetInputValueExtension

SetInputValueDefinition : Description? Name : Type DefaultValue? Directives[Const]?

SetInputValueExtension : extend Name Directives[Const]?

Similar to SetFieldExtension, SetInputValueExtension cannot define the input value's type, and we don't know a good representation that would allow us to add a DefaultValue to the input.

Example:
```graphql argument-extension
type Person {
  name: String
  extend age(minimum: Int)
}
```
union
```graphql argument-extension-union
type Person {
  extend name(short: Boolean)
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

SetUnionTypeExtension :

- extend union Name Directives[Const]? UnionMemberTypes
- extend union Name Directives[Const]

NOTE: SetUnionTypeDefinition to UnionTypeDefinition, and SetUnionTypeExtension is equivalent to UnionTypeExtension. This is because Union does not have any possible inner Schema Coordinates (union members are *not* possible coordinates).

## Enums

SetEnumTypeDefinition :

- Description? enum Name Directives[Const]? SetEnumValuesDefinitionOrExtension
- Description? enum Name Directives[Const]? [lookahead != `{`]

SetEnumTypeExtension :

- extend enum Name Directives[Const]? SetEnumValuesDefinitionOrExtension
- extend enum Name Directives[Const] [lookahead != `{`]

SetEnumValuesDefinitionOrExtension : { SetEnumValueDefinitionOrExtension+ }

SetEnumValueDefinitionOrExtension :
- SetEnumValueDefinition
- SetEnumValueExtension

SetEnumValueDefinition : Description? EnumValue Directives[Const]?
SetEnumValueExtension : extend EnumValue Directives[Const]?

## Input Objects

InputObjectTypeDefinition :

- Description? input Name Directives[Const]? SetInputFieldsDefinitionOrExtension
- Description? input Name Directives[Const]? [lookahead != `{`]

InputObjectTypeExtension :

- extend input Name Directives[Const]? SetInputFieldsDefinitionOrExtension
- extend input Name Directives[Const] [lookahead != `{`]

SetInputFieldsDefinition : { SetInputValueDefinitionOrExtension+ }

## Directives

NOTE: we are assuming that directives on directive definitions, (https://github.com/graphql/graphql-spec/pull/1206) is in the spec at this point.

SetDirectiveDefinition : Description? directive @ Name SetArgumentsDefinition? Directives[Const]?
`repeatable`? on DirectiveLocations

SetDirectiveExtension : extend directive @ Name SetArgumentsDefinition? Directives[Const]

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
