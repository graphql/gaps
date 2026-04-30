# Contributing to GraphQL Auxiliary Proposals (GAPs)

Thanks for your interest in contributing! GAPs are community-driven proposals
that address issues outside the core GraphQL specifications.

## GAP Numbering

Each GAP is numbered after the GitHub Pull Request (PR) that introduces it. For
example, if the PR that adds a GAP is `graphql/gaps#10`, the proposal becomes
**GAP-10**. Until the PR is filed and the number known, use `GAP-0` as a
placeholder.

## Filing a GAP

Before filing a GAP you're encouraged to create an issue outlining the topic to
gauge public interest, but doing so is not necessary.

1. Clone the repository and create a folder in the root called `GAP-0`.
2. Add the required files to this folder as described below (`README.md`,
   `DRAFT.md` and `metadata.yml`), commit them, and open a pull request (PR).
3. Update the GAP number to match the PR number (`graphql/gaps#13` has PR number
   13). Do not zero-pad the PR number.
   - Rename the folder from `GAP-0` to `GAP-N` where N is the PR number number.
   - Update `id` in `metadata.yml` to be the PR number.
   - If not yet configured, update the `discussion` path in `metadata.yml` to
     point to the PR.
4. Ping `@graphql/gaps-editors` to find a sponsor, add them to `metadata.yml`.

Once approved by the authors and sponsor, `CODEOWNERS` will be updated and the
PR will be merged.

> [!IMPORTANT]
> GAP numbers never change. If a proposal needs significant changes, create a
> new GAP and deprecate the old one.

### Required files

Each `GAP-N` folder must include:

- `DRAFT.md` — the working document of the proposal/specification, written in
  [`spec-md`](https://spec-md.com/) format
- `README.md` — a brief overview, why it exists, current status, challenges,
  drawbacks, and related resources/prior art (written in GitHub Flavoured
  Markdown)
- `metadata.yml` — maintainers, status, and related metadata

#### `metadata.yml`

Required fields:

```yml
id: <the PR number, or 0 if not yet known>
title: <title>
# GAPs are never "strawman". Later we'll probably add additional statuses. If in
# doubt, choose "proposal"
status: proposal | draft | accepted
authors:
  - "Your Name <noreply@example.com>"
sponsor: "@githubUername"
# An separate GitHub issue, discussion, or other public forum where discussion
# of this GAP occurs. Otherwise, this can be set to the URL of the PR in which
# the GAP was submited.
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

To release a version of a GAP, copy the current `DRAFT.md` into a `versions`
folder named for the year and month of release:

```bash
cp GAP-N/DRAFT.md GAP-N/versions/YYYY-MM.md
```

Rules:

- At most one versioned release is allowed per month.
- A versioned release may only be edited in the month it was published, and even
  then only for trivial typos or exceptional circumstances (e.g. security
  issues).

### `GAP-N/versions/YYYY-MM.yml`

This optional file can be created/edited by the TSC or editors to outline the
status of a published release, including a top-of-document notice or errata.

## Commit access

Commit access is granted to this repo to the GAP editors and to members of the
[GraphQL TSC](https://github.com/graphql/graphql-wg/blob/main/GraphQL-TSC.md).
To request to become a GAP editor, please reach out to a TSC member.

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
