# Operation Expressions

A standard syntax that people, tools and documentation can use to concisely and
consistently describe, reference and generate semantic positions in a GraphQL
executable document.

"Schema coordinates" give a standard human- and machine-readable way to
unambiguously refer to entities within a GraphQL schema: types, fields, field
arguments, enum values, directives and directive arguments.

"Operation expressions" build on the schema coordinates syntax, reusing and
expanding it to handle operation concerns.

## Referencing a path

Imagine you have the following GraphQL query:

```graphql
{
  businesses: searchBusinesses(name: "Automotive") {
    id
    name
    owner: personByOwnerId {
      id
      name
      email # <<< HERE
    }
  }
}
```

You can reference the marked (`<<< HERE`) field with the following operation expressions:

- `Person.email` - this is the "schema coordinate" which uniquely identifies the
  field, but lacks context on how we retrieved it
- `>businesses>owner>email` - given the GraphQL query document, this is
  sufficient to uniquely identify this specific reference (caveat: duplicate
  fields would all be referenced with the same expression)
- `>businesses:searchBusinesses>owner:personByOwnerId>email` - this contains
  more context than the above, indicating not just the aliases but the actual
  field names too; with this access to the operation document is not required to
  determine what was requested
- `>businesses:searchBusinesses(name:)>owner:personByOwnerId>email` - this
  contains even more context (the argument names that were used)

## Generating a document

You can also use operation expression syntax to generate documents and
fragments, for example the expression
`>businesses:searchBusinesses(name:)>owner:personByOwnerId>email` we saw above
can generate the following document:

```graphql
query ($name: String!) {
  businesses: searchBusinesses(name: $name) {
    owner: personByOwnerId {
      email
    }
  }
}
```

## Documentation Permalinks

The navigation stack in a documentation explorer such as GraphiQL could be
represented by a concise query parameter using operation expressions:

```
?docs=User.friends>latestMedia>Post.title
```

This simple expression would represent browsing through the following stack in
GraphiQL:

- `User` type
- `User.friends` field (returns a `User`)
- `User.latestMedia` field (returns a `Media` union)
- `Post` type in Media union
- `title` field

## Analytics

Operation expressions can be used as a "signature" for a query pattern reaching
a particular field, helping you to see how many times it is used through a
particular path:

```
counters['MyQuery:>city(name:)>library(number:)>book(isbn:)']++
```
