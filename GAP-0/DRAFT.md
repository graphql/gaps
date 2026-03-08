# GraphQL Mock Specification

*Draft - February 2026*

```graphql
directive @mock(
  variant: String
) on QUERY | MUTATION | SUBSCRIPTION | FIELD
```

# Overview

This specification defines the `@mock` directive to allow GraphQL clients to
return mocked data for fields or entire operations.

Mock data may be defined for fields and types that do not exist in the type
system. This enables backend and client developers to work in parallel; client
developers can start building applications using expected new fields without
waiting for the server to implement the new schema.

Use of Large Language Models (LLMs) is suggested as a means of creating and
maintaining mock data. Mock data is stored in JSON files and read statically
when requests are executed.

**Example**

`@mock` can be applied to fields:

```graphql example
query GetBusinessInfo {
  business(id: "123") {
    name
    hours @mock(variant: "morning-only") {
      open
      close
    }
  }
}
```

Mock data is stored and returned statically from JSON files:

```json example
{
  "morning-only": {
    "data": {
      "open": "8:00am",
      "close": "12:00pm"
    },
    "__appliesTo__": "Business.hours"
  }
}
```

The client transforms the document to remove mocked
_[selections](https://spec.graphql.org/September2025/#Selection)_ before
executing or sending the request to the server. Upon receiving a response from
the server, mock values are merged into the response object before yielding to
the application.

Multiple mocks for the same selection in an operation may be defined, allowing
developers to swap out what is returned by changing the argument to `@mock`.

`@mock` may also be applied to operation roots, preventing a network request
entirely:

```graphql example
query GetBusinessInfo @mock(variant: "five-star-bakery") {
  business(variant: "123") {
    name
    rating
  }
}
```

# Directive

## Mock Variants

`@mock` accepts a required {"variant"} argument which maps to a *mock variant
id*. This uniquely identifies a *mock value* (stored in the *mock file*) to
return for the field or operation where `@mock` is applied.

## Returning Mock Data

If `@mock` is applied to the operation's root field (e.g. {"query"}), the entire
response must be resolved from a *mock file*. 

If `@mock` is applied to non-root fields only, the client must transform the
document to remove any selections which have `@mock` applied before sending the
request to the server. Mock values are resolved from a *mock file*. When the
server's response is received, the client merges each *mock value* into the
response before yielding to the application.

Mock values must **not** be generated dynamically at runtime. Mock values must
be resolved from the *mock file*.

The mechanism for GraphQL clients running in a web browser or mobile client to
read the *mock file* is implementation defined. See:
[Appendix: Reading Mock Files](#sec-Reading-Mock-Files).

## Mock Files

Each operation or fragment that contains one or more `@mock` directives must
have an associated *mock file*.

:: A *mock file* is a JSON file which maps *mock variant id* keys to a
*mock variant*.

:: The *executable target* of a *mock file* is defined to be the name of the
operation or fragment in which mock variants defined in the mock file may be
applied.

Mock files are intended to be long-lived and may checked into version control.

Note: This is useful for client developers working on a project over an extended
period of time, and where the client code depends on GraphQL schema that does
not yet exist.

### Mock File Location

The *mock file* must be named `{Name}.json`, where `{Name}` is the name of the
*executable target* (that is, the name of the operation or fragment in which
the mock variants may be applied).

TODO: Support multiple files per target - instead of {Name}.json, it could
be a directory of mock files, nested by the operation target - i.e.
{Name}/arbitrary.json

Mock files should be stored in a `__graphql_mocks__` directory adjacent to the
source file containing the *operation target*.

**Example**

For an operation named `GetBusinessInfo` defined in `BusinessDetails.graphql`:

```
.
├── __graphql_mocks__
│   └── GetBusinessInfo.json
└── BusinessDetails.graphql
```

### Mock File Structure

The mock file contains a JSON object which maps *mock variant id* keys to a
*mock variant*.

:: A *mock variant id* is any key in the object that does not start with two
underscores (`__`).

:: A *mock vatiant* is the object associated with each *mock variant id*.

The *mock variant* object may contain only the following keys:

- {"data"} (required)
- {"errors"}
- {"extensions"}
- {"__appliesTo__"} (required)
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

#### ___description__

{"__description__"} may contain a string which describes the *mock value* in
natural language. This value should be used when regenerating the *mock value*.

```json example
{
  "5-star-business: {
    "data": {
      "business": {
        "name": "The Great British Bakery",
        "rating": 5.0
      }
    },
    "__appliesTo__": "Query",
    "__description__": "A delicious bakery with a rating of 5.0"
  },
}
```

#### __appliesTo__

{"__appliesTo__"} must be defined as the resolved
_[schema coordinate](https://spec.graphql.org/September2025/#sec-Schema-Coordinates)_
of the field or root operation type where `@mock` is applied, or may be applied,
with the *mock variant id*.

**Example**

For the following fragment:

```graphql example
fragment FooFields on Foo {
  # location resolves to "Foo.bar"
  bar @mock(variant: "basic-bar")

  # location resolves to "Foo.baz"
  baz @mock(variant: "basic-baz") {
    qux
  }
}
```

This would be a (minimally) vald corresponding *mock file*:

```json example
{
  "basic-bar": {
    "data": "...",
    "__appliesTo": "Foo.bar"
  },
  "basic-baz": {
    "data": { "qux": "..." },
    "__appliesTo": "Foo.baz"
  },
}
```

#### __metadata__

{"__metadata__"} may be a key-value mapping for additional user or application
defined metadata.

## Mock Entry Validation

### Query Changes

As development progresses, the shape of a query may change — fields may be added,
removed, or renamed. When this happens, an existing *mock value* may no longer
match the expected shape. Conforming clients must detect when a *mock value* is
incompatible with its operation and force corrective action.

Mocks must be validated as part of the application test suite.

Note: It is possible to detect if a JSON payload is valid for a given operation
by constructing an in-memory GraphQL server that has no resolvers, and uses the
JSON payload as its {rootValue} - and ensuring no errors are thrown for
execution of the operation against the test server.

GraphQL clients should warn or throw for an invalid *mock value*. Implementers
must detect this, and similarly force corrective action (e.g. by forcing the
user to regenerate or fix the *mock value* in the *mock file*).

### Missing Mock Name

If the requested *mock variant* does not exist in the associated *mock file*
for the containing operation or fragment, the client must raise an error
indicating the available mock ids.

### Invalid Mock Value

If a *mock value* does not conform to the expected shape, client behavior is
implementation-defined. Clients should validate mock values and provide helpful
error messages during development.

# Mock Generation

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

Implementers of this specification could provide an
[Agent Skill](https://agentskills.io/home) conforming to the Agent Skills
Specification. This allows coding agents to discover and use mock management
capabilities.

The following is a suggested `SKILL.md`. Implementers are welcome to replace or
adapt this prompt to suit their implementation.

```markdown
---
name: gql-mock-manager
description: Create and edit mock values for GraphQL operations using the @mock directive
---

This skill manages mock values for GraphQL operations using the `@mock`
directive.

## Capabilities

- **Add mock variant**: Create a new named mock value for an existing operation
- **Modify mock**: Update an existing mock value
- **List mocks**: Show available mock ids for an operation

## Mock Files

Mock files are located in `__graphql_mocks__/{Name}.json` adjacent to
the source file containing the operation or fragment. {Name} is the name of
that operation or fragment.

Each mock file is a JSON object where keys are "mock variant ids" and values are
"mock variants".

A "mock variant" is an object containing the following attributes:

- **`data`** (required): The mock value - the raw data to be returned - defined by https://spec.graphql.org/September2025/#sec-Data.
- **`errors`**: May contain an errors array - defined by https://spec.graphql.org/September2025/#sec-Errors.
- **`extensions`**: May contain aribtrary data - defined by https://spec.graphql.org/September2025/#sec-Extensions.
- **`__appliesTo__`** (required): The schema coordinate for which the mock value is valid - defined by https://spec.graphql.org/September2025/#sec-Schema-Coordinates.
- **`__description__`**: A natural language description of the data being returned.
- **`__metadata__`**: May contain a key/value mapping of arbitrary data.

**Example**

\`\`\`json
{
  "5-star-business: {
    "data": {
      "business": {
        "name": "The Great British Bakery",
        "rating": 5.0
      }
    },
    "__appliesTo__": "Query",
    "__description__": "A delicious bakery with a rating of 5.0"
  },
  "has-no-rating": {
    "data": {
      "business": {
        "name": "El Greco Deli",
        "rating": null
      }
    },
    "__appliesTo__": "Query",
    "__description__": "A new restaurant which has not yet been rated - the rating field returns null"
  },
}
\`\`\`

## Generating mock variants

When generating a new mock value, add the following to your context window:

- the user's prompt (e.g. "add a @mock response for this field <highlighted position>)
- the corresponding selection and nested selection set in the operation or fragment
- the GraphQL schema. It is posisble that some of the fields in the mock
  response already exist in the schema, and may be looked up - you can use the
  fields' descriptions, sibling fields' descriptions and the field's parent type
  description as additional context.

When regenerating an existing mock value, also include the exising mock value
payload and preserve as much as possible (unless the user has specified
otherwise).

Ensure the generated mock value is valid against the selections in the operation
or fragment.

Use plausible and realistic values. e.g. for "Business.name", use a made-up
business name such as "The Great British Bakery". Avoid using "foo", "bar",
"myBusiness", "string" etc as values.

Generate a __description__ field which summarizes the output, and has enough
context such that it could be used to regenerate a similarly shaped payload.

The values generated for leaf nodes do not matter and do not need to be
preserved or included in the description - unless otherwise specified by the
user.

### Errors

When the mock should represent an error state, use the GraphQL errors format -
unless you know that the schema uses a union to represent error state. You must
check against the schema.

**Example**

\`\`\`json
{
  "data": { "fieldName": null },
  "errors": [{
    "path": ["fieldName"],
    "message": "field error"
  }]
}
\`\`\`

## Instructions

When asked to add or update a mock variant:

1. Locate the operation or fragment's mock file
2. Read the existing mock file to understand the mock value shape
3. If creating a new mock, create a new entry with a descriptive mock variant id
4. Ensure the mock value includes appropriate `data` and/or `errors` fields
5. Add a summary of the user's prompt to the `__description__` field
6. Write the updated mock file

## Schema

Look for the GraphQL schema in <repo_root>/schema.graphql to understand what
shape of data should be returned. Ask the user if this file cannot be found, and
remember where it is located for future. 
```

# Appendix

_This section is non-normative and used for clarification only._

## Dynamic Mock Variant IDs

In theory, mock variant IDs may be derived from operation
_[variables](https://spec.graphql.org/September2025/#sec-Language.Variables)_.
This is neither explicitly disallowed or encouraged.

A use case would be to build an interface to let viewers control which
*mock value* is used. For example, the following GET parameters:

```example
GET /my_page?gql_mock_variants=barMock=some-variant-id;bazMock=some-other-variant-id
```

Could be used as inputs to the following operation:

```graphql example
query Foo($barMock: String, $bazMock: String) {
  bar @mock(variant: $barMock)
  baz @mock(variant: $bazMock)
}
```

Clients must manually coerce the directive argument variables (similar to
[CoerceArgumentValues](https://spec.graphql.org/draft/#CoerceArgumentValues()).

This is currently outside the scope of this specification.

## Reading Mock Files

GraphQL Clients that implement this schema must have access to the data
contained in mock files when requests are executed. Since web browsers and
mobile applications cannot read remote filesystems, a mechanism is required
to make the data contained in mock files available to the client.

This mechanism is implementation defined.

The reference implementation for web serializes the contents of all mock files
into a single JSON object, and is embedded on the webpage in a `<script>` HTML
tag.

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
