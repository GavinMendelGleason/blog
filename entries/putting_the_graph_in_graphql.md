# GraphQL in TerminusDB
**Putting the Graph in GraphQL**

From the name, GraphQL, one would think you were dealing with a graph
oriented query language. But then one would be incorrect. GraphQL is
neither particularly graph oriented, nor is it a query language.

Don't get me wrong, GraphQL is great, it's just not exactly what it
says on the tin. In reality, GraphQL is a sort of API-killer. A way to
avoid having to write a bazillion HTTP endpoints, and instead have a
well structured, schema aware approach to getting information in, and
out of a service.

This is extremely useful, reducing development time for new APIs and
by having well defined schemas which actually check for correctness of
the objects being communicated, many errors and regressions are averted.

Yet wouldn't it be great if GraphQL was also about *graph*s and a
*query language*?

Well that's certainly what we thought at TerminusDB! We've recently
implemented a suite of features which allows you to query a TerminusDB
project using GrahpQL in such a way that deep linking can be discovered.

# Back links

In a typical document in TerminusDB, you specify classes and their
fields. This might look as follows:

```json
{ "@type" : "Class",
  "@id" : "Person",
  "name" : "xsd:string",
  "pet" : { "@type" : "Set", "@class" : "Pet"},
  "friend" : { "@type" : "Set", "@class" : "Friend" }
}
{ "@type" : "Class",
  "@id" : "Pet",
  "@abstract" : [],
  "name" : "xsd:string"
}
{ "@type" : "Class",
  "@id" : "Dog",
  "@inherits" : ["Pet"]
}
```

TerminusDB automagically constructs a GraphQL schema derived from this
one, which allows us to query it. A query might look like:

```graphql
query
{
  Person {
    name
    pet {
      name
    }
  }
}
```

And we might get back a response along the lines of:

```json
{
  "data": {
    "Person": [
      {
        "name": "Joe",
        "pet": [
          {
            "name": "Mimi"
          },
          {
            "name": "Fido"
          }
        ]
      }
    ]
  }
}
```

But supposing I find Mimi wandering the streets. How can I get back
the *owner* of Mimi? We defined our edge only in one direction. Yet in
TerminusDB going in the reverse direction from an object is actually a
cheap operation.

In order to achieve this, we have *enriched* the GraphQL schema with
*back-links* which automatically give you the reverse edges of every
object field.

We can perform the reverse query as follows:


```graphql
query
{
  Pet(filter: {name : {eq : "Mimi"}}) {
    name
    _pet_of_Person{
      name
    }
  }
}
```

This query asks for a pet, whose name is mimi, and obtains the name
field, but also a link to to who they are a pet of:
`_pet_of_Person`. This field name is constructed automagically, and
the language tends to work well using the genetive construction, but
most importantly you can clearly see the type of the object from which
it comes from. This is because reverse links could come from many
different objects, all having the same field name, so it is important
to disambiguate.

Our result using my current database state is:

```json
{
  "data": {
    "Pet": [
      {
        "name": "Mimi",
        "_pet_of_Person": [
          {
            "name": "Joe"
          }
        ]
      }
    ]
  }
}
```

## Path Queries

Ok, well that is certainly handy, since we often need to use these
sorts of relationships in two directions, but what about *graphs*. Can
we weave our way through the graph to find what we want?

TerminusDB adds *path queries* to our GraphQL schema to obtain
precisely this.

A *path query* is a regular expression pattern describing the edges which
would like to follow in a graph. Its full specification is
[here](https://terminusdb.com/docs/guides/how-to-guides/query-data/path-queries).

For those familiar with regular expressions it shouldn't be too
difficult to pick, up but even if new to the concept, it's fairly
intuitive. Basically, I can write down the name of an edge: `"friend"`
then you say how many times you want to follow this edge. If you want
to follow it precisely onces, we can leave it alone, if you want to
follow it zero or more times, you write: `"friend*"`. If you want at
least one hop, but any number greater you can write: `"friend+"`. If
you want to follow it between 1 and 3 times, you can write:
`"friend{1,3}"`. If I want to go *backwards* on an edge (similarly to
the back-links above) I can use a directional modifier: `"<friend"`,
and again I can modify this with the number of hops.

Let's say we want to find everyone who has a friend with a cat named
Mimi.

```graphql
query
{
  Pet(filter: {name : {eq : "Mimi"}}) {
    _path_to_Person(path: "<pet,(friend|<friend)+") {
     	name
 	  }
  }
}
```

In English we might write this query as: "Get me all of the friends of
the owner of mimi, whether they believe they are this peron's friend,
or the person considers *them* a friend. i.e. friendship here is not
automatically symmetric, so we have to look at it from both perspectives.

The answer we get back is:

```json
{
  "data": {
    "Pet": [
      {
        "_path_to_Person": [
          {
            "name": "Candy"
          },
          {
            "name": "Doug"
          }
        ]
      }
    ]
  }
}
```

Now we're really talking about exploring the graph!

## Future Directions

We already have a nice GraphQL interface for querying, but we intend
to build out the mutation capabilities as well. We also want to have
*derived edges* which are GraphQL queries that are the result of a
WOQL query internally. This would allow us to expose very
sophisticated queries which might make use of aggregation etc. at the
level of GraphQL.

GraphQL has really simplified access to data for front end developers
and those performing analytics.  It's great to be able to expose it
in TerminusDB. For us the fit feels very natural and perhaps best of
all: we have a very high-performance GraphQL!

You should try it out.  You can either use TerminusDB by downloading
it from our repositories, or you sign up for a free account at
[terminusdb.com](https://dashboard.terminusdb.com).
