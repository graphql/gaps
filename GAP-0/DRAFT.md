# @mock Directive Specification

This document specifies the `@mock` directive, which allows GraphQL clients to
return mocked data for individual fields, selection sets, or entire operations.

Mock data may be defined for fields and types that do not yet exist in the
schema. This enables backend and client developers to work in parallel — client
developers can start building applications using expected new fields without
waiting for the server to implement the new schema.

```graphql example
query GetBusinessInfo {
  business(id: "123") {
    name
    # this field doesn't exist yet on the server!
    website @mock(value: "https://www.example.com")
  }
}
```

`@mock` can also be used to mock subtrees and whole operations:

```graphql example
# mock just the 'hours' field
query GetBusinessHours {
  business(id: "123") {
    name
    hours @mock(variant: "morning-only") {
      open
      close
    }
  }
}

# mock the entire operation
query GetBusinessRating @mock(variant: "five-star-bakery") {
  business(id: "123") {
    name
    rating
  }
}
```

Mock data is stored in JSON files and read statically when requests are
executed:

```json example
{
  "morning-only": {
    "data": {
      "open": "8:00am",
      "close": "12:00pm"
    },
    "__path__": "business.hours"
  }
}
```

The client transforms the document to remove mocked {Selection}s before
executing or sending the request to the server. Upon receiving a response from
the server, mock values are merged into the response object before yielding to
the application.

Use of Large Language Models (LLMs) is suggested as a means of creating and
maintaining mock data.

# Directive

```graphql
directive @mock(
  variant: String
  value: String
) on QUERY | MUTATION | SUBSCRIPTION | FIELD
```

## Arguments

`@mock` accepts two mutually exclusive arguments: {"variant"} and {"value"}.
Exactly one of these arguments must be provided. Providing both {"variant"} and
{"value"} in the same `@mock` directive is a validation error.

### variant

{"variant"} maps to a _mock variant id_. This uniquely identifies a _mock value_
(stored in the _mock file_) to return for the field or operation where `@mock`
is applied.

A *mock variant id* must not start with two underscores (`__`). This is
reserved and must not be used as a {"variant"} argument value.

The mechanism for clients to read the *mock file* is implementation-defined.
See: [Appendix: Reading Mock Files](#sec-Reading-Mock-Files).

### value

{"value"} provides an inline *mock value* as the value of the argument.

When {"value"} is provided, the client uses the supplied string as the mock
response for the annotated field without consulting a *mock file*.

{"value"} may only be applied to fields that resolve to
_[leaf types](https://spec.graphql.org/September2025/#sec-Leaf-Field-Selections)_
(scalars and enums). It must not be applied to fields that return object types
or to operation roots.

Because {"value"} is always a string, the client must coerce the string to the
appropriate JSON type:

CoerceInlineValue(value) :
  1. If {value} is {"null"}, return `null`.
  1. If {value} is {"true"}, return the boolean `true`.
  1. If {value} is {"false"}, return the boolean `false`.
  1. If {value} can be parsed as a base-10 number, return {value} as number.
  1. Return {value} as a string.

Note: This specification requires JSON as the serialization format for GraphQL
responses.

## Transforming Operations

Operations must be transformed to remove any selections which have `@mock`
applied before sending the request to the server. The client must insert a _mock
value_ in each corresponding position before yielding a response to the
application.

If every selection in a {SelectionSet} uses `@mock`, the parent that contains
that {SelectionSet} must be removed:

- If the parent is a field or inline fragment, remove it from the operation.
- If the parent is a fragment definition, remove the definition and all of its
  corresponding fragment spreads.

After removing mocked selections, if an operation
[variable](https://spec.graphql.org/September2025/#sec-Language.Variables) is no
longer referenced by any remaining selection, the variable definition must also
be removed from the operation. An unreferenced variable would produce an invalid
document per the
_[All Variables Used](https://spec.graphql.org/September2025/#sec-All-Variables-Used)_
rule.

When `@mock` is applied to a field, the _mock value_ must always be included in
the response, regardless of other directives present on the same field. In
particular, `@mock` takes precedence over `@skip` and `@include` — the mock data
is always returned, irrespective of whether the field would otherwise be skipped
or included based on those directives' conditions.

If `@mock` is applied to an operation definition (e.g. {"query"}), the entire
response must be resolved from a _mock file_. No request should be sent to the
server.

When `@mock` is applied to a field selected beneath a list-typed field, the
same _mock value_ is inserted into each corresponding item in the list. To
represent distinct values for different list items, apply `@mock` to the
list-typed field or to an enclosing field, and provide the list as part of the
_mock value_.

For example, this query inserts the same {"blurHash"} value for each item in
{"menuItems"}:

```graphql example
query GetMenuItemPhotos {
  business(id: "123") {
    menuItems {
      name
      blurHash @mock(value: "LEHV6nWB2yk8pyo0adR*.7kCMdnj")
    }
  }
}
```

**Example**

The resulting operation that may be sent to a server as a result of applying all
transformation logic specified above can be seen in this example:

```graphql example
fragment FooFields on Foo {
  foo @mock(value: "foo!")
  bar
}

fragment MoreFooFields on Foo {
  baz @mock(value: "baz!")
}

query GetFoo($id: ID!, $planet: String!) {
  foo(id: $id) {
    id
    ...FooFields
    ...MoreFooFields
    ... on Foo { baz @mock(value: "baz!") }
    sayHello(planet: $planet) @mock(value: "hello world")
  }
}
```

Will be transformed into the following:

```graphql example
fragment FooFields on Foo {
  bar
}

query GetFoo($id: ID!) {
  foo(id: $id) {
    id
    ...FooFields
  }
}
```

**Formal Specification**

TransformOperation(document, selectionSet) :
  1. If {selectionSet} has a `@mock` directive, return {null}.
  1. For each {selection} in {selectionSet}:
      * If {selection} has a `@mock` directive, remove {selection} from
        {selectionSet}.
      * Otherwise, if {selection} has a {SelectionSet}:
        * Let {childSelectionSet} be the {SelectionSet} of {selection}.
        * Let {document} be {TransformOperation(document, childSelectionSet)}.
        * If {childSelectionSet} is now empty, remove {selection} from
          {selectionSet}.
  1. For each fragment definition in {document}:
      * Let {fragmentSelectionSet} be the {SelectionSet} of the fragment.
      * Let {document} be {TransformOperation(document, fragmentSelectionSet)}.
      * If the fragment's {SelectionSet} is now empty, remove the definition
        and all corresponding fragment spreads from {document}.
  1. For each variable definition in {document}:
      * If the variable is no longer referenced by any remaining selection,
        remove it.
  1. Return {document}.

# Mock Files

:: A *mock file* is a `.json` file that maps each *mock variant id* to a
*mock variant*.

Each operation or fragment that contains one or more `@mock` directives using
the {"variant"} argument must have an associated *mock file*. Operations or
fragments where all `@mock` directives use only the {"value"} argument do not
require a *mock file*.

Note: Mock files are intended to be long-lived and may be checked into version
control. This is useful for client developers working on a project over an
extended period of time, and where the client code depends on GraphQL schema
that does not yet exist.

## Mock File Location

The *mock file* must be named `{Name}.json`, where `{Name}` is the name of the
operation or fragment within which the mock values may be used.

To avoid mock file naming collisions, this specification requires that all
operation and fragment names within a project are unique.

The mock file must be stored in a directory named {"__graphql_mocks__"} adjacent
to the source file containing the operation or fragment.

**Example**

For an operation named `GetBusinessInfo` defined in `BusinessDetails.graphql`:

```
.
├── __graphql_mocks__
│   └── GetBusinessInfo.json
└── BusinessDetails.graphql
```

## Mock File Structure

The mock file contains a JSON object which maps *mock variant id* keys to a
*mock variant*.

:: A *mock variant id* is any key in the object that does not start with two
underscores (`__`).

:: A *mock variant* is the object associated with each *mock variant id*.

### Mock Variant Object

A *mock variant* object may contain **only** the following keys:

- {"data"} (required)
- {"errors"}
- {"extensions"}
- {"__path__"} (required)
- {"__description__"}
- {"__metadata__"}

#### data

:: {"data"} stores the *mock value*. It may be a scalar, object, array, or
`null`, depending on what in the operation is being mocked.

The client inserts {"data"} directly under the {"data"} key of the operation's
response — it must not be nested inside an additional {"data"} entry.

For example, when `@mock` is applied to an operation root, the *mock variant*
should look like this:

```json example
{
  "mock-id": {
    "data": {
      "business": {
        "name": "The Great British Bakery",
        "rating": 5.0
      }
    },
    "__path__": "Query"
  }
}
```

Not this:

```json counter-example
{
  "mock-id": {
    "data": {
      "data": {
        "business": {
          "name": "The Great British Bakery",
          "rating": 5.0
        }
      }
    },
    "__path__": "Query"
  }
}
```

For a list-typed field, {"data"} contains the list value directly:

```json example
{
  "breakfast-menu": {
    "data": [
      { "name": "Pancakes", "price": "$8.00" },
      { "name": "Waffles", "price": "$9.00" }
    ],
    "__path__": "business.menuItems"
  }
}
```

#### errors

{"errors"} may contain an array of error objects conforming to the
[GraphQL error format](https://spec.graphql.org/September2025/#sec-Errors).
This is valid for both operation-level and field-level `@mock` directives.

The client must merge {"errors"} into the GraphQL server's response if present.

#### extensions

{"extensions"} may be a key-value mapping of arbitrary data, conforming to the
[Extensions](https://spec.graphql.org/September2025/#sec-Extensions) section of
the GraphQL specification.

The client must merge {"extensions"} into the GraphQL server's response if
present.

#### __description__

{"__description__"} may contain a string which describes the *mock value* in
natural language. This value should be used when regenerating the *mock value*.

```json example
{
  "5-star-business": {
    "data": {
      "business": {
        "name": "The Great British Bakery",
        "rating": 5.0
      }
    },
    "__path__": "Query",
    "__description__": "A delicious bakery with a rating of 5.0"
  }
}
```

#### __path__

{"__path__"} is the *field path* within the operation or fragment where `@mock`
is or may be applied for a given *mock variant id*.

:: A *field path* is a dot-separated string of field names (or aliases, where
present) representing the location of the field relative to the root of the
operation or fragment. 

For `@mock` on an operation root, {"__path__"} is the root operation type name
(e.g. {"Query"}, {"Mutation"}, or {"Subscription"}).

**Example**

For the following fragment:

```graphql example
fragment FooFields on Foo {
  # field path is "bar"
  bar @mock(variant: "basic-bar")

  # field path is "aliasedBar"
  aliasedBar: bar @mock(variant: "aliased-bar")

  baz {
    # field path is "baz.qux"
    qux @mock(variant: "basic-qux")
  }

  # field path is "greeting"
  greeting @mock(variant: "basic-greeting") {
    salutation
    planet
  }
}
```

This would be a (minimally) valid corresponding *mock file*:

```json example
{
  "basic-bar": {
    "data": "...",
    "__path__": "bar"
  },
  "aliased-bar": {
    "data": "...",
    "__path__": "aliasedBar"
  },
  "basic-qux": {
    "data": "...",
    "__path__": "baz.qux"
  },
  "basic-greeting": {
    "data": {
      "salutation": "...",
      "planet": "..."
    },
    "__path__": "greeting"
  }
}
```

#### __metadata__

{"__metadata__"} may be a key-value mapping for additional user or application
defined metadata.

# Validation

As development progresses, the shape of the operation or schema may change.
Since mock files may be checked into version control and persist across schema
changes, an existing *mock value* in a *mock file* or inline {"value"} argument
may become invalid over time.

Conforming clients must verify that mock data is valid for each operation.

## Mock File Validation

If a *mock variant id* referenced by a {"variant"} argument does not exist in
the *mock file*, this is a validation error.

Each _mock variant id_ within a _mock file_ must be unique; duplicate keys
trigger a validation error.

The {"__path__"} of each *mock variant* must correspond to a valid *field path*
within the operation or fragment associated with the *mock file*.

GraphQL clients must raise an error for an invalid *mock value* defined inside
a *mock file*.

A *mock value* is valid when its shape is compatible with the operation's
selections at the *field path* where `@mock` is applied. For each selected
field, the *mock value* must satisfy {CompleteValue()} for the field's
schema type. Fields present in the operation but not defined in the
schema are skipped during validation.

Note: It is also possible to detect if a JSON payload is valid for a given
operation by constructing an in-memory GraphQL server that has no resolvers and
uses the JSON payload as its {rootValue} — then ensuring no errors are
thrown for execution of the operation against the test server. The schema
must be modified to include any new types and fields referenced in the
*mock value*.

## Inline Mock Value Validation

The {"value"} argument may only be used on leaf fields (scalars and enums). When
the field exists in the schema, the coerced value must match the field's return
type.

**Formal Specification**

ValidateInlineValueArgument(field, schema) :
  1. If the `@mock` directive on {field} uses the {"value"} argument:
      * {field} must not have a {selectionSet}.
      * The {"variant"} argument must not be present.
      * Let {value} be the string provided to the {"value"} argument.
      * If {field} exists in {schema}:
        * Let {coerced} be the result of {CoerceInlineValue(value)}.
        * {coerced} must be the return type of {field}.

## No Nested @mock Validation

`@mock` must not be used on a field that is a child of another field which also
uses `@mock`:

```graphql counter-example
query Foo {
  bar @mock(variant: "bar-fields") {
    # ❌ Validation error: @mock on baz is nested inside @mock on bar
    baz @mock(value: "hi from baz")
  }
}
```

This rule extends across fragment boundaries. {FragmentSpread} nodes must be
recursively expanded:

```graphql counter-example
fragment FooFields on Foo {
  # ❌ Validation error: @mock on bar would be nested inside MockedFoo
  bar @mock(value: "baz")
}

query UnmockedFoo {
  foo {
    ...FooFields
  }
}

query MockedFoo {
  foo @mock(variant: "foo-fields") {
    ...FooFields
  }
}
```

**Formal Specification**

ValidateNoNestedMocks(selectionSet, isMockedByParent) :
  1. For each {selection} in {selectionSet}, expanding any fragment spreads:
    * Let {fieldUsesMock} be {true} if {selection} has a `@mock` directive,
      otherwise {false}.
    * If {isMockedByParent} is {true}, {fieldUsesMock} must be {false}.
    * Let {isChildrenMocked} be {true} if both {isMockedByParent} and
      {fieldUsesMock} is {true}, otherwise {false}.
    * If {selection} has a {selectionSet}:
      * Let {nextSelectionSet} be that {selectionSet}.
      * Call {ValidateNoNestedMocks(nextSelectionSet, isChildrenMocked)}.

## No Empty Operation Root Validation

An operation's root {SelectionSet} must contain at least one selection
that does not use `@mock`. If every selection in the operation's root
{SelectionSet} is mocked, the transformed operation would contain an
empty {SelectionSet}, which is not valid GraphQL.

```graphql counter-example
# ❌ Validation error: all top-level fields are mocked
query GetBusiness {
  business(id: "123") @mock(variant: "bakery") {
    name
    rating
  }
}
```

**Formal Specification**

ValidateNonEmptyRootSelectionSet(operationDefinition) :
  1. If {operationDefinition} does not have the `@mock` directive applied:
      * Let {rootSelectionSet} be the root selection set in
        {operationDefinition},
        expanding any fragment spreads.
      * At least one selection in {rootSelectionSet} must not have a `@mock`
        directive.

# Mock File Generation

The mechanism for generating and maintaining mock files is
implementation-defined.

However, this specification is designed to work well with LLM-based coding
agents. Developers using agents can request new mock variants conversationally.

It is recommended that implementers provide a workflow for developers to
generate contextually appropriate mock data based on field names, types,
and surrounding context.

For example, a developer may add a mock with the following prompt:

```example
"add a mock for GetBusinessInfo where the rating field returns an error"
```

**Non-Normative: Suggested Agent Skill**

Implementers of this specification may provide an
[Agent Skill](https://agentskills.io/home) conforming to the Agent Skills
Specification. This allows coding agents to discover and use mock management
capabilities.

The following is a suggested `SKILL.md`. Implementers are welcome to replace or
adapt this prompt to suit their implementation:

[SKILL.md](./SKILL.md)

# Appendix

_This section is non-normative._

## Dynamic Mock Variant IDs

The {"variant"} argument could be passed in from operation
_[variables](https://spec.graphql.org/September2025/#sec-Language.Variables)_.

A use case would be to build an interface to let viewers control which
*mock value* is used. For example, the following GET parameters:

```example
GET /my_page?gql_mock_variants=barMock=some-variant-id;bazMock=some-other-variant-id
```

This could be mapped to operation variables for the following operation:

```graphql example
query Foo($barMock: String, $bazMock: String) {
  bar @mock(variant: $barMock)
  baz @mock(variant: $bazMock)
}
```

GraphQL servers resolve variable references in arguments during
execution via {CoerceArgumentValues()}, but this does not happen on
the client. Clients that support variable references in `@mock`
arguments must implement their own coercion of directive argument
variables.

## Reading Mock Files

GraphQL clients that implement this specification must have access to the data
contained in mock files when requests are executed. Since web browsers and
mobile applications cannot read remote file systems, a mechanism is required
to make the data contained in mock files available to the client.

This mechanism is implementation-defined.

## Schema-Aware Clients

Schema-aware clients face additional complexity: operations using the `@mock`
directive may reference types and fields not yet present in the server schema.
Such clients must patch their local schema to include these definitions, or
disable validation for mocked operations. The mechanism for schema patching is
outside the scope of this specification, however contributions addressing this
are welcome for inclusion in a future version of this document.

## Trusted Documents

Clients that use
[trusted documents](https://graphql.org/learn/security/#trusted-documents)
register a hash of each operation at build time and send only that hash at
runtime.

The document that is hashed must be the result of {TransformOperation}. The same
transformation must be applied at both build time (when computing the hash) and
at runtime (when preparing the request).
