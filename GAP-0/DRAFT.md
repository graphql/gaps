# @mock Directive Specification

This document specifies the `@mock` directive, which allows GraphQL clients to
return mocked data for fields or entire operations.

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

The client transforms the document to remove mocked
_[selections](https://spec.graphql.org/September2025/#Selection)_ before
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

{"variant"} maps to a *mock variant id*. This uniquely identifies a
*mock value* (stored in the *mock file*) to return for the field or operation
where `@mock` is applied.

### value

{"value"} provides an inline *mock value* directly in the document.

When {"value"} is provided, the client uses the supplied string as the mock
response for the annotated field without consulting a *mock file*.

{"value"} may only be applied to fields that resolve to
_[leaf types](https://spec.graphql.org/September2025/#sec-Leaf-Field-Selections)_
(scalars and enums). It must not be applied to fields that return object types
or to operation roots.

Because {"value"} is always a string, the client must coerce the string to the
appropriate JSON type before merging it into the response:

CoerceInlineValue(value) :
  1. If {value} is {"null"}, return `null`.
  1. If {value} is {"true"}, return the boolean `true`.
  1. If {value} is {"false"}, return the boolean `false`.
  1. If {value} can be parsed as a base-10 number, return {value} as number.
  1. Return {value} as a string.

Note: This specification requires JSON as the serialization format for GraphQL
responses.

## Returning Mock Data

If `@mock` is applied to an operation definition (e.g. {"Query"}), the entire
response must be resolved from a *mock file*; no request should be sent to the server.

If `@mock` is applied to non-root fields only, the client must transform the
document to remove any selections which have `@mock` applied before sending the
request to the server. For fields using {"variant"}, mock values are resolved
from a *mock file*. For fields using {"value"}, the mock value is the coerced
inline string. When the server's response is received, the client merges each
*mock value* into the response before yielding to the application.

When `@mock` is applied to a field, the *mock value* must always be included in
the response, regardless of other directives present on the same field. In
particular, `@mock` takes precedence over `@skip` and `@include` — the mock
data is always returned, irrespective of whether the field would otherwise be
skipped or included based on those directives' conditions.

Mock values must **not** be generated dynamically at runtime. Mock values must
be resolved from the *mock file* or from the inline {"value"} argument.

The mechanism for GraphQL clients running in a web browser or mobile client to
read the *mock file* is implementation-defined. See:
[Appendix: Reading Mock Files](#sec-Reading-Mock-Files).

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

TODO: Support multiple files per operation/fragment. Instead of {Name}.json, it
may be a directory of mock files, nested by the operation/fragment name. e.g.
`{Name}/arbitrary.json`.

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

:: {"data"} stores the *mock value*. It may be `null` if the field is nullable.

#### errors

{"errors"} may contain an array of error objects conforming to the
[GraphQL error format](https://spec.graphql.org/September2025/#sec-Errors).
This must be merged into the GraphQL operation's response if defined.

TODO: Define merging algorithm and resolution algorithm for conflicts

#### extensions

{"extensions"} may be a key-value mapping of arbitrary data. This must be merged
into the GraphQL operation's response if defined.

TODO: Define merging algorithm and resolution algorithm for conflicts

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

TODO: Define field paths in a separate specification. See
https://github.com/graphql/graphql-spec/issues/1215

For `@mock` on an operation root, {"__path__"} is the root operation type name
(e.g. {"Query"}).

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

Conforming clients must check that mock data is valid for each operation.

## Mock File Validation

If a *mock variant id* referenced by a {"variant"} argument does not exist in
the *mock file*, this is a validation error.

All *mock variant ids* within a *mock file* must be unique; duplicate keys are a
validation error.

GraphQL clients must raise an error for an invalid *mock value* defined inside
a *mock file*.

A *mock value* is valid when its shape is compatible with the operation's
selections at the *field path* where `@mock` is applied. For each selected
field, the *mock value* must satisfy
_[CompleteValue](https://spec.graphql.org/draft/#CompleteValue())_ for the
field's schema type. Fields present in the operation but not defined in the
schema are skipped during validation.

Note: It is also possible to detect if a JSON payload is valid for a given
operation by constructing an in-memory GraphQL server that has no resolvers, and
uses the JSON payload as its {rootValue} — and ensuring no errors are thrown for
execution of the operation against the test server. The schema must be modified
to include any new types and fields referenced in the *mock value*.

## Inline Mock Value Validation

The {"value"} argument may only be used on scalar fields. When the field exists
in the schema, the coerced value must match the field's return type.

**Formal Specification**

ValidateInlineValueArgument(field, schema) :
  1. If the `@mock` directive on {field} uses the {"value"} argument:
      * {field} must not have a {selectionSet}.
      * The {"variant"} argument must not be present.
      * Let {value} be the string provided to the {"value"} argument.
      * If {field} exists in {schema}:
        * Let {coerced} be the result of {CoerceInlineValue(value)}.
        * {coerced} must be the return type of {field}.

## Nested @mock Validation

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

This rule extends across fragment boundaries. *FragmentSpread* nodes must be
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

Clients must manually coerce the directive argument variables (similar to
[CoerceArgumentValues](https://spec.graphql.org/draft/#CoerceArgumentValues())).

This is currently outside the scope of this specification.

## Reading Mock Files

GraphQL clients that implement this specification must have access to the data
contained in mock files when requests are executed. Since web browsers and
mobile applications cannot read remote file systems, a mechanism is required
to make the data contained in mock files available to the client.

This mechanism is implementation defined.

## Schema-Aware Clients

Schema-aware clients face additional complexity: operations using the `@mock`
directive may reference types and fields not yet present in the server schema.
Such clients must patch their local schema to include these definitions, or
disable validation for mocked operations. The mechanism for schema patching is
outside the scope of this specification, however contributions addressing this
are welcome for inclusion in a future version of this document.

**Trusted Documents**

TODO: add a section to clarify that while this intended to be used in local dev
(where the documents don't need to be hashed), because mock files can get
checked in, and @mock directives could get checked in, @mock selections need
to not be included in the actual document that gets hashed (i.e. the same
transforming needs to happen at runtime and query compile time)
This could be useful in staging environments or on prod (behind a feature flag). 
