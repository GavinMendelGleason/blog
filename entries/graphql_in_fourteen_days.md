# How to implement GraphQL in fourteen days

My vision of TerminusDB has, since inception, been that it should be a
flexible content platform. That's why we've tried to develop not only
schema modelling capabilities but also git-for-data features, diff
calculators and automatically generated user interfaces.

Given our focus on content management and delivery, it might seem
strange then that it took us so long to start trying to position
TerminusDB as an ideal platform for headless CMSs. It took our
community proding us into it, but we're taking the plunge.

To be a content platform it helps if you can plug in to existing data
ecosystems. And this has been a point of friction for TerminusDB.

And that's why we decided to go ahead and implement GraphQL for
TerminusDB. We (mostly Matthijs van Otterdijk with some help from
myself) implemented automatic schema construction from TerminusDB
schemata and the associated Query engine in a little over a week.

I'm extremely excited about this development, since it means that now
TerminusDB will be available to many more languages (anything with a
GraphQL client), there will be a high quality open-source method of
developing with GrahpQL, and a straightforward method of exposing RDF
as a GraphQL endpoint.

It feels like a lot of unnessary frictions simply fall away, and
TerminusDB seems to fit so naturally into the GraphQL environment that
I'm confident it will quickly be one of the best platforms around for
serving convent via GraphQL.

## Juniper

We didn't do it from scratch of course, we leveraged the already
existing, and very well designed (if not so brilliantly documented)
[Juniper](https://github.com/graphql-rust/juniper).

This toolkit lets you develop GraphQL endpoints directly from your
rust datastructures when you have a static schema, or to generate a
dynamic schema yourself.

We used both approaches to expose different parts of TerminusDB.

## Static - Exposing TerminusDB's inards

The internal aspects of TerminusDB, the system database (`_system`),
the repository graph (`_meta`) and the commit graph (`_commits`) are
all available to explore using the GraphQL endpoint. This makes
various administrative tasks simpler, and the powerful introspection
tools that GraphQL provides, makes exploring this fairly straightfoward.

You can point any graphql client at a valid TerminusDB data product
and you'll get access, not only to the data product, but this meta
data as well. For instance, you can look at the log of updates to the
database, or explore which branches exist.

![TerminusDB Log Example](../assets/TerminusDB_GraphQL_Log.png)

## Dynamic - Modelling TerminusDB Documents in GraphQL

TerminusDB is build around the concept of a document.  In order to
expose this to GraphQL, we automatically create a number of queries
which correspond to the data as modelled in TerminusDB

The basic idea is that each type gets a query at the top level, and
each property of this object which has a range of an object type also
gets this type of query.

In order to faciiliate aggregation, paging, metadata and query, we
segment the query for document types into two parts (as per best
practice [regarding pagination and
cursors](https://graphql.org/learn/pagination/))

At the top level, we will mention the type of document we are
interested in.

```graphql
{
  Starship(name="Millenium Falcon"){
    pilot{
      name
    }
  }
  People{
    name
    pilot_of_Starship {
      name
    }
  }
}
```




## The Future


