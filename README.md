# GraphQL Auxiliary Proposals (GAPs)

This repository provides a public home for GraphQL Auxiliary Proposals (GAPs),
community specifications and auxiliary proposals that address issues outside of
the core GraphQL spec.

This repository is not generally intended for custom scalar specifications,
which already have dedicated homes elsewhere.

## Visit the website

This repository is not designed to be browsed directly; please instead visit the
website which automatically renders each specification via `spec-md` and
includes additional navigational assistance and cross-linking:

https://gaps.graphql.org/

## GAP Numbering

GAPs use number ranges to categorize different types of proposals:

- **1XXX** — Community directive specifications

Other ranges may be added in the future as new categories are identified.

## Repository structure

Each proposal lives in its own `GAP-NNNN` folder and must include:

- `DRAFT.md` — the working document of the proposal/specification
- `README.md` — a brief overview and status, including challenges/drawbacks and
  related resources or prior art
- `metadata.yml` — authorship, sponsorship, status, and related metadata

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full GAP process.
