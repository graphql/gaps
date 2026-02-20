# Contributing to GraphQL Auxiliary Proposals (GAPs)

Thanks for your interest in contributing! GAPs are community-driven proposals
that address issues outside the core GraphQL specifications.

## GAP Number Ranges

GAPs use number ranges to categorize different types of proposals:

- **1XXX** — Community directive specifications

Other ranges may be added in the future as new categories are identified. The
TSC are responsible for creating new GAP ranges.

## Filing a GAP

1. File an issue outlining the topic for public vetting.
2. If there is sufficient interest, open a PR that adds a new folder named
   `GAP-0` containing the required files. The proposal must have at least one
   author.
3. Find a sponsor with merge rights (this may be one of the authors).
4. Once approved by the authors and sponsor, GAP editors assign the GAP a
   number from the appropriate range (not necessarily the next available
   number), configure `CODEOWNERS`, and merge.
5. GAP numbers never change. If a proposal needs significant changes, create a
   new GAP and deprecate the old one.

### Required files

Each `GAP-NNNN` folder must include:

- `DRAFT.md` or `DRAFT/` — the working document of the proposal/specification,
  written in [`spec-md`](https://spec-md.com/) format (see below)
- `README.md` — a brief overview, why it exists, current status, challenges,
  drawbacks, and related resources/prior art (written in GitHub Flavoured
  Markdown)
- `metadata.yml` — maintainers, status, and related metadata

#### Single-file vs split-file format

Specifications may be authored as either:

- **Single-file**: A single `DRAFT.md` file containing the entire specification.
- **Split-file**: A `DRAFT/` directory with an `Index.md` entry point that may
  include other files. This is useful for larger specifications that benefit
  from being organized into multiple sections.

For split-file specs, the `DRAFT/index.md` file serves as the main entry point
and should use spec-md's import syntax to include other files as needed.

#### `metadata.yml`

Required fields:

```yml
id: <number, populated by editor>
title: <title>
# GAPs are never "strawman". Later we'll probably add additional statuses. If in
# doubt, choose "proposal"
status: proposal | draft | accepted
authors:
  - "Your Name <noreply@example.com>"
sponsor: "@githubUsername"
# A GitHub issue, discussion, or other public forum
discussion: "https://github.com/graphql/graphql-wg/issues/..."
```

Additional optional fields:

```yml
related:
  - <number>
replaces: <number>
supersededBy: <number>
tags:
  - <string>
```

## Updating a GAP

GAPs may be maintained over time. Major changes to a GAP are discouraged,
instead a new GAP should be created, however evolution of a GAP over time is
often desired.

The sponsor of a GAP is responsible for ensuring changes to the GAP are
approved by the authors before merging, though this task may also be performed
by the TSC. The authors are responsible for guiding contribution to the GAP.

### Versioning

To release a version of a GAP, copy the current draft into a `versions` folder
named for the year and month of release:

```bash
# Single-file format
cp GAP-NNNN/DRAFT.md GAP-NNNN/versions/YYYY-MM.md

# Split-file format
cp -r GAP-NNNN/DRAFT GAP-NNNN/versions/YYYY-MM
```

Rules:

- At most one versioned release is allowed per month.
- A versioned release may only be edited in the month it was published, and even
  then only for trivial typos or exceptional circumstances (e.g. security
  issues).

### `GAP-NNNN/versions/YYYY-MM.yml`

This optional file can be created/edited by the TSC or editors to outline the
status of a published release, including a top-of-document notice or errata.

## Commit access

Commit access is granted to this repo to the GAP editors and to members of the
[GraphQL TSC](./GraphQL-TSC.md). To request to become a GAP editor, please reach
out to a TSC member.

## GraphQL Specification Membership Agreement

This repository is managed by EasyCLA. Project participants must sign the free
([GraphQL Specification Membership agreement](https://preview-spec-membership.graphql.org)
before making a contribution. You only need to do this one time, and it can be
signed by
[individual contributors](http://individual-spec-membership.graphql.org/) or
their [employers](http://corporate-spec-membership.graphql.org/).

To initiate the signature process please open a PR against this repo. The
EasyCLA bot will block the merge if we still need a membership agreement from
you.

You can find
[detailed information here](https://github.com/graphql/graphql-wg/tree/main/membership).
If you have issues, please email
[operations@graphql.org](mailto:operations@graphql.org).
