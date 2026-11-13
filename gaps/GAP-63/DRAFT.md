# Change Tables

This document specifies a convention for allowing slow operations to complete on
a server without the client having to hold onto the connection. This may be
useful in applications that cannot otherwise use streaming protocols, or for
background jobs running on a schedule.

The progress of each operation is recorded in a database table, which clients
poll. [Section 1](#sec-Database-Schema) specifies the database schema.
[Section 2](#sec-GraphQL-Schema) specifies an optional GraphQL schema over it.

# Database Schema

## Changes

:: A _change_ is one run of a slow operation. It is recorded as a row of a
_change table_.

:: A change's _work_ is the operation it runs, e.g. a request to a payment
provider to refund an order.

A change has one of the following statuses. Its status is initially `changing`,
and must change at most once, to `changed` or `failed`.

| Status     | Meaning                                                           |
| ---------- | ----------------------------------------------------------------- |
| `changing` | The work has not finished.                                        |
| `changed`  | The work finished, and all its effects are visible.               |
| `failed`   | The work failed or timed out. Some of its effects may be visible. |

## Change Tables

A change table's name should end in `_changes`, e.g. `refund_changes`.

A change table must have the following columns. It may have others.

| Column       | Value                                                           | Type          |
| ------------ | --------------------------------------------------------------- | ------------- |
| `id`         | The change's id. Primary key.                                   | `uuid`        |
| `status`     | The change's status. Not null.                                  | `text`        |
| `error`      | The reason the change failed. Non-null if `status` is `failed`. | `text`        |
| `created_at` | When the record was inserted. Not null.                         | `timestamptz` |
| `updated_at` | When `status` last changed. Not null.                           | `timestamptz` |

Note: Exact column types are implementation-defined. This document assumes
PostgreSQL.

```sql example
CREATE TABLE refund_changes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status       text NOT NULL CHECK (status IN ('changing', 'changed', 'failed')),
    error        text CHECK ((status = 'failed') = (error IS NOT NULL)),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    -- additional columns
    order_id     uuid NOT NULL,
    amount_cents integer NOT NULL CHECK (amount_cents > 0)
);
```

A change table should retain finished rows for a reasonable time. It may then
delete them, e.g. on a TTL.

## Timeouts

:: A change table's _timeout_ is a duration longer than its work can take.

A change whose `status` is `changing`, and whose `updated_at` is longer ago than
its table's timeout, should be read as `failed`, with an `error` that says it
timed out.

# GraphQL Schema

A GraphQL interface over change tables may be provided using the following
schema.

```graphql
enum ChangeStatus {
  CHANGING
  CHANGED
  FAILED
}

interface Change {
  id: ID!
  status: ChangeStatus!
  error: String
  createdAt: String!
  updatedAt: String!
}
```

`Change` may implement `Node` in accordance with the
[Global Object Identification](https://relay.dev/graphql/objectidentification.htm)
specification.

Each _change table_ is represented by a concrete type that implements the
`Change` interface.

**Database Column to GraphQL Field Mapping**

- `id` → `Change.id` (`ID`)
- `status` → `Change.status` (`ChangeStatus`)
- `error` → `Change.error` (`String`)
- `created_at` → `Change.createdAt` (`String` or a `DateTime` custom scalar)
- `updated_at` → `Change.updatedAt` (`String` or a `DateTime` custom scalar)

Additional columns may be represented as additional fields.

## Root Operation Type Fields

### Mutation

Changes are exposed via a field on `Mutation` to return a Change object.

A field that returns a change object must do so without waiting for it to complete.

```graphql example
type RefundChange implements Change {
  id: ID!
  status: ChangeStatus!
  error: String
  createdAt: String!
  updatedAt: String!
  amountCents: Int!
  order: Order
}

type Mutation {
  refundOrder(orderId: ID!, amountCents: Int!): RefundChange!
}
```

### Query

Each change exposed via a Mutation field must have a corresponding
field on `Query` suffixed with `change`, which accepts the change's
`id` as an argument, and returns the change object.

```graphql example
type Query {
  refundOrderChange(id: ID!): RefundChange
}
```
