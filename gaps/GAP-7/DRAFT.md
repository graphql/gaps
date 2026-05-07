# Fully Qualified Operation Name (FQON)

**Introduction**

:: This document specifies _Fully Qualified Operation Name_ (FQON), a
human‑readable, unambiguous identifier for GraphQL operations.

The primary motivation is to define a "lookup key" that may be used in static
configuration files (e.g. for alerting rules per operation) which correctly
targets operations, but without having to update the configuration each time a
_document id_ changes.

This specification assumes usage of
[trusted documents](https://graphql.org/learn/security/#trusted-documents) and
[Git version control](https://git-scm.com/).

**Example**

Given the following operation defined in a Git repository named `yelp/frontend`,
and in a package named `styleguide`:

```graphql example
query GetHeaderData {
  ...
}
```

The _FQON_ for this operation may be defined as:

```example
GetHeaderData:styleguide:yelp/frontend:1
```

When defining alerting rules for this operation, we can target all versions of
this operation by omitting the _version_ suffix:

```example
GetHeaderData:styleguide:yelp/frontend
```

**Motivation**

We may identify operations using either:

- The _operation name_ (e.g. {"GetHeaderData"})
- The _document id_ produced by hashing the operation body (e.g. {"605fad0ee0a88..."})

Because GraphQL operation names are not be guaranteed to be globally unique,
they cannot reliably identify an operation across multiple platforms or
deployment versions. On the other hand, a _document id_ is guaranteed to be
unique but is inconvenient for humans to read and maintain.

Note: See <README.md> for additional context.

**Use Cases**

- A _FQON_ may be printed instead of the operation name in application logs.
  This encourages correct behavior when humans use this identifier to look up
  the operation body in the document registry or codebase.
- A partial _FQON_ may be used instead of a _document id_ as lookup keys in
  static configuration files (e.g. alerting rules) in order to avoid duplication
  and extra steps when an operation is updated (and thus, its _document id_).

## Definition

FullyQualifiedOperationName :: OperationName : Project? : RepoFullName : Version

OperationName
: The _Name_ of the operation as declared on the _OperationDefinition_ node.

Project
: The identifier for the package or directory containing the operation.
: This is defined only for operations that live in a monorepo.

RepoFullName
: The full name of the Git repository (in the format of {"owner/repo"}).

Version
: A positive integer that increments each time the document body changes.
: The tuple of _OperationName_, _Project_ and _RepoFullName_ identifies a
document; the _Version_ part distinguishes its revisions.
: The _trusted document_ registry or other persistence layer must calculate or
store version numbers, starting at {1} and increasing monotonically.

**Examples**

A _Fully Qualified Operation Name_ with all parts:

```example
GetHeaderData:styleguide:yelp/frontend:1
```

A _Fully Qualified Operation Name_ which omits `Project` (i.e.
`petstore/website` is _not_ a monorepo, and has no concept of "projects"):

```example
AllPets::petstore/website:1
```

## Partial Matches

Any _FQON_ part may be omitted to perform a partial match.

With the exception of omitting _Project_, partial matches must also omit the
`:Version` suffix.

The primary use case of this specification is to omit `:Version` for use as
lookup keys in static configuration files, as a way to target to all versions
of an operation.

**Examples**

| Pattern                     | Matches                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GetFoo::`                  | All operations named {"GetFoo"}                                                                         |
| `::bazcorp/qux`             | All operations inside the {"bazcorp/qux"} Git repository                                                |
| `GetFoo:barpkg:bazcorp/qux` | All operations named {"GetFoo"} inside the {"barpkg"} package inside the {"bazcorp/qux"} Git repository |

## Security Considerations

It is recommended to avoid exposing FQONs in client code to avoid leaking
potentially sensitive internal repository names or project/directory names.

Clients should still send only the _document id_ over the wire, which is opaque.
