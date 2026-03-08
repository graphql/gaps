# GAP-0: GraphQL Mock Specification

## Overview

This proposal defines the `@mock` directive, enabling GraphQL clients to return
mocked data for fields or entire operations. Mock data is stored statically in
JSON files alongside the operations that use them.

## Why It Exists

Client and backend developers often work in parallel, but clients cannot build
against schema that doesn't yet exist. The `@mock` directive lets client
developers define and use mock responses for fields and types that may not yet
be present in the server schema, unblocking frontend development.

## Current Status

**Draft** — The specification is under active development.

## Challenges and Drawbacks

- **Schema-aware clients** must patch their local schema or disable validation
  for mocked operations, adding implementation complexity.
- **Trusted documents** workflows require that `@mock` selections are stripped
  before hashing, meaning the same transformation must happen at both runtime
  and query compile time.
- **Mocking Fragments** — currently out of scope.
