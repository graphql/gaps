# Algebraic Static Analysis for Queries

<!-- cspell:words componentwise -->

## Introduction

This document specifies an API for obtaining sound static summaries of
GraphQL operations. An analysis supplies a small algebra; a shared engine handles
GraphQL execution semantics and computes the summary.

Static analysis answers questions about an operation before resolvers run: How
expensive can it be? How large can its response become? Which combinations of
protected fields may it access? A useful answer must cover every feasible
execution, including runtime object types, conditional selections, collected
fields, and recursively merged children.

The API for using this analysis is deliberately small:

```ts example
interface Algebra<Summary> {
  empty(): Summary;
  field(group: CollectedFieldGroup, childSummary: Summary): Summary;
  combine(left: Summary, right: Summary): Summary;
  join(left: Summary, right: Summary): Summary;
  requiresVariables?(): boolean;
}
```

For example, a maximum-response-size analysis can use a number as its summary:

```ts example
const maxResponseSize: Algebra<number> = {
  empty: () => 0,
  field: (group, children) => 1 + listMultiplier(group) * children,
  combine: (left, right) => left + right,
  join: (left, right) => Math.max(left, right),
};

const maximumFields = analyzeOperation({
  schema,
  document,
  algebra: maxResponseSize,
});
```

`field` counts one response field and accounts for repeated list elements;
`combine` adds fields that may occur together; and `join` accounts for mutually exclusive
outcomes. Subject to the configured list bound and the algebra's soundness
obligations, the engine guarantees that `maximumFields` bounds every response to
the operation. The analysis author does not reimplement fragment traversal, runtime
type reasoning, directive evaluation, field collection, or child merging.

That separation is the proposal's central claim: define how summaries compose
locally, then let the engine compute a sound summary for the operation.

## Background: What static analysis must handle

GraphQL operation syntax does not directly describe one response shape. It describes
a family of possible executions selected by runtime object types and request
variables.

Consider this schema and query. Assume `featured` has cost 1, `title` has cost 2,
`pageCount` has cost 4, and `duration` has cost 9.

```graphql example
interface Media {
  title: String
}

type Book implements Media {
  title: String
  pageCount: Int
}

type Film implements Media {
  title: String
  duration: Int
}

type Query {
  featured: Media
}

query Featured {
  featured {
    ... on Media {
      title
    }
    ... on Book {
      title
      pageCount
    }
    ... on Film {
      duration
    }
  }
}
```

When `featured` is a `Book`, the two `title` occurrences have the same response
name and resolver call. GraphQL collects them into one field, so the child cost
is `2 + 4`, not `2 + 2 + 4`.

When `featured` is a `Film`, the `Media.title` and `Film.duration` selections are
active together, so their costs must be combined. The `Book` and `Film` cases are
mutually exclusive, so their costs must instead be joined as alternatives. The
sound, precise result for these cases is:

```text
1 + max(2 + 4, 2 + 9) = 12
```

Adding every syntactic selection produces the safe but unnecessarily loose
result 18. Treating every fragment as an alternative produces 10, which is
unsafe because `title` and `duration` can execute together.

Fragments may be distant, abstract type conditions may overlap, and one Boolean
variable may guard sibling fields and recursive children. Every selected
composite field begins the same problem again over the merged child selection
sets of its collected occurrences. These semantics are common to cost,
response-size, authorization, and other analyses, so they belong in the shared
engine rather than in every analysis.

### Scope

This specification applies to statically analyzing a valid GraphQL
[operation](https://spec.graphql.org/September2025/#sec-Language.Operations)
against a valid schema. The engine treats query, mutation, and subscription
operations uniformly: the selected operation's
[root type](https://spec.graphql.org/September2025/#sec-Root-Operation-Types)
provides the initial parent scope, and selection sets are analyzed by the same
rules.

An individual algebra may distinguish fields under particular parent types,
including the schema's query, mutation, and subscription root types, and
summarize them accordingly. For a subscription, the summary applies to each
event response; bounding the number or aggregate cost of events requires
analysis-specific assumptions.

The engine handles:

- named and inline
  [fragments](https://spec.graphql.org/September2025/#sec-Language.Fragments);
- [type conditions](https://spec.graphql.org/September2025/#sec-Type-Conditions)
  over object, interface, and union types;
- the built-in
  [`@include`](https://spec.graphql.org/September2025/#sec--include) and
  [`@skip`](https://spec.graphql.org/September2025/#sec--skip) directives;
- response-name
  [collection](https://spec.graphql.org/September2025/#sec-Field-Collection),
  including [aliases](https://spec.graphql.org/September2025/#sec-Field-Alias);
- merging child selection sets from collected field occurrences; and
- recursive analysis of nested composite fields and lists.

This specification does not define:

- a particular traversal, normalization, or case-enumeration algorithm;
- a required degree of precision beyond soundness;
- an admission threshold or enforcement policy;
- custom directive semantics.

An implementation may support executable directives beyond this scope as an
extension. Such extensions must state their execution model and additional
soundness obligations.

## API Definitions

### Summary

:: An analysis chooses a _Summary_ type. A summary describes possible operation
executions. It may be a number, tuple, set, function, or another immutable value.

An analysis also defines an ordering on summaries. `a ≼ b` means that `b` safely
covers everything covered by `a`. Different summary values may cover the same
possibilities.

### Algebra

:: An _Algebra_ defines four transfer operations over its summary domain:

empty
: `empty()` returns the summary of no selected response fields. It is the
identity for simultaneous composition and the least summary.

field
: `field(group, childSummary)` summarizes one collected response field after the
engine has summarized its merged child selection set.

combine
: `combine(left, right)` composes contributions that can occur together in one
response.

join
: `join(left, right)` bounds alternative outcomes, such as different runtime
object types or values of an unresolved Boolean condition.

The engine, not the analysis, determines whether contributions can occur
together or are alternatives.

Summary values should be immutable. An engine may reuse one value in multiple
alternatives.

### Collected field group

:: A _CollectedFieldGroup_ is a nonempty group of field occurrences that share one
response name and can be collected into one executed response field in the
represented case.

The following conceptual interface describes the information available to an
algebra. Implementations may expose it as properties, methods, or equivalent
language-specific APIs:

```ts example
interface CollectedFieldGroup {
  readonly responseName: string;
  readonly fields: readonly Field[];
  readonly representativeField: Field;
  readonly possibleTypes: readonly string[];
}
```

- `responseName` is the shared alias or field name used in the response.
- `fields` contains every collected field occurrence.
- `representativeField` is a field representation whose field name and arguments
  may be used for schema lookup and argument evaluation.
- `possibleTypes` is the nonempty set of concrete parent object types represented
  by the group.

An implementation may use an element of `fields` as `representativeField` or
provide a normalized equivalent. This specification does not require object
identity or membership in `fields`.

For a valid operation, occurrences applicable to the same concrete parent object
select the same field name and have equivalent arguments, as required by
GraphQL field-merging
[validation](https://spec.graphql.org/September2025/#sec-Field-Selection-Merging).

Multiple occurrences in one group represent one executed response field and
must not be charged independently unless the analysis's concrete semantics
explicitly require that behavior. The engine merges and recursively analyzes
all child selection sets from the group before invoking `field`.

At the top-level selection set, `possibleTypes` contains the selected operation's
root object type. An algebra may therefore recognize root fields and give fields
under query, mutation, or subscription roots analysis-specific meanings.

The algebra may inspect the group, schema metadata, and request variables.
It must not independently recurse through each occurrence's child
selection set; `childSummary` already represents their GraphQL-merged children.

### Variable requirement

`requiresVariables()` declares whether the algebra requires one concrete,
coerced request-variable environment. If omitted, it returns `false`.

An argument-sensitive analysis should return `true` when it cannot produce a
sound result for every possible variable assignment. The engine must reject an
analysis that requires variables when the caller omits them.

This declaration is an API capability check, not an algebraic transfer
operation.

## Analysis Engine

The engine owns the GraphQL-specific reasoning needed to turn an operation into calls
to the algebra.

At each selection-set boundary, it must:

1. determine the possible concrete object types in the current scope;
2. apply fragment type conditions and the built-in `@include` and `@skip`
   semantics;
3. preserve correlation between repeated uses of the same variable;
4. collect simultaneously executable field occurrences by response name;
5. recursively analyze the merged child selection sets of each collected group;
6. invoke `field` once for each collected response field;
7. use `combine` for contributions that can occur together; and
8. use `join` to bound mutually exclusive runtime alternatives.

The engine must not treat overlapping type conditions as mutually exclusive,
combine mutually exclusive concrete object types as if they execute together,
or independently count occurrences that GraphQL field collection merges into
one response field.

The traversal order and internal representation are implementation-defined.
This specification does not define traversal or precision modes.

### Soundness contract

The engine implements the GraphQL behavior in this section. The algebra must
satisfy the laws in the next section, and each execution must satisfy the
analysis's documented external assumptions. Under those conditions, the engine
provides the operation-level soundness guarantee below.

## Soundness

Soundness means that the abstract result bounds the analysis's concrete
observation of every execution represented by the inputs.

### Summary laws

The algebra operates on summaries of selection sets. Its operations must satisfy
the following laws for the engine's result to be sound.

Use the following notation:

- `a ≼ b` mean that `b` safely covers everything covered by `a`;
- `0` denote `empty()`;
- `a ⊗ b` denote `combine(a, b)`;
- `a ⊔ b` denote `join(a, b)`; and
- `F[g](a)` denote `field(g, a)`.

Every sound algebra must satisfy the following laws.

**Coverage ordering**

```text
a ≼ a
a ≼ b ∧ b ≼ c ⇒ a ≼ c
```

**Simultaneous composition**

```text
(a ⊗ b) ⊗ c = a ⊗ (b ⊗ c)
a ⊗ b = b ⊗ a
0 ⊗ a = a
a ⊗ 0 = a
0 ≼ a
(a ≼ a′ ∧ b ≼ b′) ⇒ a ⊗ b ≼ a′ ⊗ b′
```

**Alternative upper bound**

```text
a ≼ a ⊔ b
b ≼ a ⊔ b
```

An algebra used without supplied variable values must additionally satisfy the
following laws. These laws permit an engine to retain and factor unresolved
alternatives while preserving soundness.

**Least alternative bound**

```text
a ≼ u ∧ b ≼ u ⇒ a ⊔ b ≼ u
```

**Simultaneous-composition factoring**

```text
(a ⊔ b) ⊗ c ≼ (a ⊗ c) ⊔ (b ⊗ c)
```

**Field-transfer factoring**

```text
F[g](a ⊔ b) ≼ F[g](a) ⊔ F[g](b)
```

### Connecting summaries to executions

These laws connect a summary to what actually happens during execution. Each
analysis defines how to measure a concrete response and when a summary safely
covers that measurement.

The concrete measurement type may be the same as `Summary`, but it does not have
to be. Let:

- `x`, `y`, and `z` be concrete response measurements;
- `ε` be the concrete measurement of no response fields;
- `x ⊙ y` combine concrete contributions that occur together;
- `C[g](x)` measure a completed response field represented by group `g`, given
  child measurement `x`; and
- `x ≲ a` mean that abstract summary `a` safely covers concrete measurement `x`.

Concrete composition must be associative and have `ε` as its identity:

```text
(x ⊙ y) ⊙ z = x ⊙ (y ⊙ z)
ε ⊙ x = x
x ⊙ ε = x
```

Once a summary covers a concrete measurement, any summary that safely covers the
first summary must also cover that measurement:

```text
x ≲ a ∧ a ≼ b ⇒ x ≲ b
```

Finally, each local algebra operation must safely represent its corresponding
concrete operation:

```text
ε ≲ 0
x ≲ a ∧ y ≲ b ⇒ x ⊙ y ≲ a ⊗ b
x ≲ a ⇒ C[g](x) ≲ F[g](a)
```

The three lines cover an empty contribution, simultaneous contributions, and one
completed response field, respectively. For a null or scalar field value, the
child measurement is `ε`. For an object value, it is the combined measurement of
the object's response fields. For a list, the measurements of its completed
elements compose using `⊙`.

### Engine guarantee

For a valid schema and operation, an algebra satisfying the applicable soundness
laws, and executions satisfying the analysis's documented assumptions, the
engine guarantees:

- **With variables:** after coercing the supplied request variables and applying
  operation defaults, the returned summary approximates the concrete observation
  of every execution of that request.
- **Without variables:** the returned summary approximates the concrete
  observation of every execution under every valid variable assignment.

If these conditions do not hold, the engine makes no soundness guarantee.

### Limits of the guarantee

**A sound result may be conservative.** The proposal guarantees that all concrete
executions are covered by the estimated bound; it does not require every engine
to compute the same bound or the most precise possible bound. More conservative
engines may produce a looser estimate than a tighter analysis.

**Symbolic argument values may be unbounded.** An argument-sensitive analysis
cannot always produce a finite result before request variables are known. Such
an analysis must require variables or define a sound abstract bound for their
possible values.

**External assumptions are trusted.** Some useful analyses require facts that
query syntax alone cannot establish. Maximum response size needs a list
cardinality bound; IBM cost needs valid cost metadata and list sizes that bound
the response. The soundness guarantee holds only when an analysis's documented
assumptions hold.

**Algebra laws are not automatically enforced.** Mainstream type systems cannot
generally prove that custom callbacks satisfy associativity, monotonicity, or
the concrete transfer laws. Implementations can document and test these
properties, while formal models can prove them, but using the API does not by
itself establish soundness.

## Engine API

The recommended entry point function definition is:

```ts example
interface AnalyzeOperationOptions<Summary> {
  readonly schema: GraphQLSchema;
  readonly document: string | Document;
  readonly operationName?: string;
  readonly algebra: Algebra<Summary>;

  // Omit this property for variable-independent analysis.
  // Supply it, including {}, to analyze one concrete request.
  readonly variables?: Readonly<Record<string, unknown>>;
}

function analyzeOperation<Summary>(
  options: AnalyzeOperationOptions<Summary>,
): Summary;
```

Representations of schemas, documents, fields, errors, and maps are
implementation-defined.

### Input preparation

Before analysis, the entry point function (`analyzeOperation`) must:

1. parse the executable document when source text is supplied;
2. validate the document against the schema;
3. select the named operation, or select the only operation when the document
   contains exactly one; and
4. when `variables` is present, perform GraphQL variable
   [coercion](https://spec.graphql.org/September2025/#sec-Coercing-Variable-Values)
   on the supplied values and apply operation defaults.

It must return an error for an invalid document, ambiguous or missing operation,
invalid variable values, or omitted variables if required by the algebra.

An implementation may also provide a lower-level API that accepts an already
validated document, selected operation, and already-coerced variables. That API must
clearly document its validation boundary.

### Analysis without variables

When the `variables` property is absent, the engine treats variable-driven
Boolean conditions as unresolved and considers all feasible, correlated
assignments.

The result may be computed at build time, operation registration time, or
another point before a request is available. It may be reused for later requests
as long as the schema, operation, algebra configuration, and external assumptions do
not change.

In an API where property presence is observable, a present `variables` property
whose value is `undefined` is treated as an explicitly supplied empty map. A
caller requests variable-independent analysis by omitting the property.

### Analysis with variables

When the `variables` property is present, the engine analyzes the selected
request after variable coercion and operation defaults. It resolves built-in
Boolean directive conditions from that environment, and the algebra may use the
same coerced values when evaluating field arguments.

An explicitly supplied empty map is not the same as omitting `variables`. The
empty map still selects variable-dependent analysis and applies operation defaults.

## Example analyses

### IBM cost estimation

The IBM GraphQL Cost Directives
[specification](https://ibm.github.io/graphql-specs/cost-spec.html) is the
canonical motivating application. Its summary contains independent type and
field costs. Simultaneous contributions add componentwise, alternatives take a
componentwise upper bound, and the field transfer applies schema `@cost` and
`@listSize` metadata to the completed child summary.

IBM cost demonstrates why the algebra is more useful than a hard-coded field
counter:

- field, argument, input-field, and returned-type weights have distinct rules;
- list cardinality can come from request arguments, schema defaults,
  `assumedSize`, or `sizedFields` propagation;
- abstract return types must bound their possible concrete object types; and
- the type-cost and field-cost components must remain separate.

Because request variables can contain unbounded slicing arguments or recursively
nested weighted input values, an IBM cost algebra normally declares
`requiresVariables() = true`. Supplying `variables: {}` remains necessary for a
request with no explicit variable values so that operation defaults are applied.

This specification uses IBM cost as an example of the API and soundness
contract. It does not redefine the IBM directive schema or its cost rules.

The JavaScript reference
[implementation](https://github.com/duckki/graphql-static-analysis-js/blob/6ca5b86cbeeebf304d2becb42e08091969fe4f29/src/analyses/cost.ts#L255-L371)
defines IBM cost as an algebra over the shared engine.

### Authorization capability combinations

An authorization analysis can determine which protected fields may be accessed
together instead of flattening all possibilities into one footprint. Its summary
is a set of possible protected-field sets. Each member represents one combination
of field
[coordinates](https://spec.graphql.org/September2025/#sec-Schema-Coordinates)
that may be accessed together in an execution.

`empty` returns `{∅}`, one possibility that accesses no protected fields. `field`
adds its protected coordinate to every child possibility. `join` keeps the
possibilities from either side, while `combine` unions every possibility on the
left with every possibility on the right.

For example, suppose `p` and `q` are protected fields:

```text
join({{p}}, {{q}})    = {{p}, {q}}
combine({{p}}, {{q}}) = {{p, q}}
```

The first result says that either field may be accessed, but never both in the
same execution. The second says that both fields may be accessed together. A
policy checker evaluates each possible set separately, so it may permit `{p}`
and `{q}` while rejecting `{p, q}`.

This analysis does not replace resolver-level authorization when access depends
on argument values, object identity, or runtime data. Those inputs require a
richer summary and concrete soundness relation, or a runtime authorization
check.

## Reference implementations

The following projects informed this specification:

- [`graphql-lean`](https://github.com/duckki/graphql-lean) is the formal model.
  It defines the algebra, concrete response interpretation, local proof
  obligations, and generic theorems lifting sound algebras to whole-query
  soundness.
- [`graphql-static-analysis-js`](https://github.com/duckki/graphql-static-analysis-js)
  is the reference implementation for the `analyzeOperation` API, including the
  distinction between omitted and supplied variables.
- [`graphql-static-analysis-rs`](https://github.com/duckki/graphql-static-analysis-rs)
  provides a reusable Rust engine and maximum-response-size and IBM cost
  analyses.

These implementations may provide additional APIs and implementation-specific
options. Such additions are not part of this specification.
