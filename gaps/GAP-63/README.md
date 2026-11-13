# GAP-63: Change Tables

This GAP defines a convention for slow operations that complete on the server
without the client holding the connection open. Each run of an operation is a
_change_, recorded as a row in a _change table_. Clients poll the row to learn
when the change is `changed` or `failed`.
