# Contributing to GraphQL Auxiliary Proposals (GAPs)

Thanks for your interest in contributing! GAPs are community-driven proposals
that address issues outside the core GraphQL specifications.

## Roles

- **Editor** — a person with write access to this repository
  ([@graphql/gaps-editors](https://github.com/orgs/graphql/teams/gaps-editors)),
  approved by the TSC to administer the GAP program.
- **Sponsor** — an _editor_ assigned to a GAP who is responsible for approving
  the initial contents. A _sponsor_ may also be an _author_.
- **Author** — a person (or people) who have made significant contributions to a
  GAP, listed in the `authors` field of `metadata.yml`. _Authors_ are given
  commit access via `CODEOWNERS` to merge their own and others' submissions to
  the GAP.

## GAP Numbering

Each GAP is numbered after the GitHub Pull Request (PR) that introduces it. For
example, if the PR that adds a GAP is `graphql/gaps#10`, the proposal becomes
**GAP-10**. Until the PR is filed and the number known, use `GAP-0` as a
placeholder.

## Filing a GAP

Before filing a GAP you're encouraged to create an issue outlining the topic to
gauge public interest, but doing so is not necessary.

1. Clone the repository and create a folder at `gaps/GAP-0`.
2. Add the required files to this folder as described below (`README.md`,
   `DRAFT.md` and `metadata.yml`), commit them, and open a pull request (PR).
3. Update the GAP number to match the PR number (`graphql/gaps#10` has PR number
   10). Do not zero-pad the PR number.
   - Rename the folder from `gaps/GAP-0` to `gaps/GAP-N` where N is the PR
     number.
   - Update `id` in `metadata.yml` to be the PR number.
   - If not yet configured, update the `discussion` path in `metadata.yml` to
     point to the PR.
4. Ping `@graphql/gaps-editors` to find a sponsor, add them to `metadata.yml`.

Once approved by the _authors_ and _sponsor_, the PR should be merged by the
_sponsor_.

`CODEOWNERS` will automatically be updated allowing _authors_ to merge future
contributions to their GAP.

> [!IMPORTANT]
> GAP numbers never change. If a proposal needs significant changes, create a
> new GAP and deprecate the old one.

### Required files

Each `gaps/GAP-N` folder must include:

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
  - name: "Your Name"
    email: "noreply@example.com"
    githubUsername: "@yourGithubUsername"
sponsor: "@githubUsername"
# A separate GitHub issue, discussion, or other public forum where discussion
# of this GAP occurs. Otherwise, this can be set to the URL of the PR in which
# the GAP was submitted.
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

The _sponsor_ of a GAP is responsible for ensuring changes to the GAP are
approved by the _authors_ before merging, though this task may also be performed
by the TSC. The _authors_ are responsible for guiding contribution to the GAP.

### Versioning

To release a version of a GAP, copy the current `DRAFT.md` into a `versions`
folder named for the year and month of release:

```bash
cp gaps/GAP-N/DRAFT.md gaps/GAP-N/versions/YYYY-MM.md
```

Rules:

- At most one versioned release is allowed per month.
- A versioned release may only be edited in the month it was published, and even
  then only for trivial typos or exceptional circumstances (e.g. security
  issues).

### `gaps/GAP-N/versions/YYYY-MM.yml`

This optional file can be created/edited by the TSC or editors to outline the
status of a published release, including a top-of-document notice or errata.

## Commit access

Commit access is granted to this repo to _editors_
([@graphql/gaps-editors](https://github.com/orgs/graphql/teams/gaps-editors)),
and to members of the
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
