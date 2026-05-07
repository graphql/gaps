# GAP-7: Fully Qualified Operation Name (FQON)

Fully Qualified Operation Names (FQONs) are an alternate way to identify and
refer to GraphQL operations that provide both human readability and uniqueness
guarantees.

The primary motivation is to define a "lookup key" that may be used in static
configuration files (e.g. for alerting rules per operation) which correctly
targets operations, but without having to update the configuration each time a
_document id_ changes.

## The problem

When using
[trusted documents](https://graphql.org/learn/security/#trusted-documents), we
may identify operations in two different ways:

1. The "operation name" (e.g. `GetConsumerHeaderData`)
2. The "document id" (e.g. `605fad0ee0a88...`)

_Operation names are not guaranteed to be unique_.

When using operation names, a developer might see `"GetUserInfo"` in service log,
copy and paste that string, use `git grep` and find it in the codebase -- only
to later discover it's the _wrong_ `GetUserInfo` query!

- Query names are only guaranteed to be unique with additional tooling.
- Even if tooling guarantees uniqueness within a repository, query names could
  be reused in a _different_ repository — e.g. Web/iOS/Android code might
  feasibly live in different Git repositories, and reuse operation names for
  similar features.
- Additionally, servers may receive traffic for different versions of
  the same query in order to support old mobile application installs - which
  would share the same operation name.

Document IDs are unambiguous and may be used to solve this problem. However,
document IDs are not human friendly since they don't carry any semantic meaning,
which encourages developers to use document names in instead - which leads the
footgun outlined above.

Additionally, by definition, document IDs change each time the operation is
updated. If we use document IDs as lookup keys in an alerting configuration
file, this must be updated each time a new version of the query is published.
This creates duplication and a maintenance burden.

## Solution

A _Fully Qualified Operation Name_ (FQON) is a human readable string that can
provide the same guarantees of uniqueness as document IDs, but and can be used
partially to omit the version number in such cases as alert config files.

**Example**:

```yaml
# alert_thresholds.yaml
operations:
  - fqon: GetFoo::bazcorp/qux
    error_ratio: 0.3
    owner: myteam@example.com
  - fqon: BarStuff::bazcorp/qux
    error_ratio: 0.4
    alert: myteam@example.com
```

## Definition

The format is:

```
name:project:repo:version
```

This is enough information to unambiguously identify the exact document
(assuming that client tooling guarantees no duplicate operation names per
project).

**Example**:

```
GetConsumerHeaderData:yelp-styleguide:yelp/frontend:3
```

The right hand side components of the FQON can be omitted for a partial match:

**Example**:

```
GetConsumerHeaderData:yelp-styleguide:yelp/frontend
```

^ this will match any version of the "same" query, and is recommended for use
as lookup keys in static configuration files

### ARN Syntax

`:` as a separator is inspired by [ARNs](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference-arns.html)
