---
name: graphql-mock
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
- **`extensions`**: May contain arbitrary data - defined by https://spec.graphql.org/September2025/#sec-Extensions.
- **`__path__`** (required): The field path within the operation or fragment where `@mock` is applied. A dot-separated string of field names (or aliases, where present) relative to the root. For `@mock` on an operation root, use the root operation type name (e.g. `"Query"`, `"Mutation"`, `"Subscription"`). When a field has an alias, use the alias in the path.
- **`__description__`**: A natural language description of the data being returned.
- **`__metadata__`**: May contain a key/value mapping of arbitrary data.

**Example**

```json
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
  },
  "has-no-rating": {
    "data": {
      "business": {
        "name": "El Greco Deli",
        "rating": null
      }
    },
    "__path__": "Query",
    "__description__": "A new restaurant which has not yet been rated - the rating field returns null"
  }
}
```

## Generating mock variants

When generating a new mock value, add the following to your context window:

- the user's prompt (e.g. "add a @mock response for this field <highlighted position>")
- the corresponding selection and nested selection set in the operation or fragment
- the GraphQL schema. It is possible that some of the fields in the mock
  response already exist in the schema, and may be looked up - you can use the
  fields' descriptions, sibling fields' descriptions and the field's parent type
  description as additional context.

When regenerating an existing mock value, also include the existing mock value
payload and preserve as much as possible (unless the user has specified
otherwise).

Ensure the generated mock value is valid against the selections in the operation
or fragment.

Use plausible and realistic values. e.g. for "Business.name", use a made-up
business name such as "The Great British Bakery". Avoid using "foo", "bar",
"myBusiness", "string" etc. as values.

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

```json
{
  "data": { "fieldName": null },
  "errors": [{
    "path": ["fieldName"],
    "message": "field error"
  }]
}
```

## Instructions

When asked to add or update a mock variant:

1. Locate the operation or fragment's mock file
2. Read the existing mock file to understand the mock value shape
3. If creating a new mock, create a new entry with a descriptive mock variant id
4. Ensure the mock value includes appropriate `data` and/or `errors` fields
5. Add a summary of the user's prompt to the `__description__` field
6. Write the updated mock file

## Schema

Look for the GraphQL schema in the repository to understand what shape of data
should be returned. (e.g. <repo_root>/schema.graphql). Ask the user if the
schema file cannot be found, and remember where it is located for future.
