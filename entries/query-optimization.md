# Graph Query Optimization in TerminusDB

Query optimization is always great fun, so I thought I'd describe a
bit of how we plan to do query optimisation in TerminusDB's GraphQL.

As I've discussed in [TerminusDB
Internals](../entries/graph_representation.md) we use a very specific
set of immutable data structures which help to make query retrieval
fast for graphs. This also means we have somewhat unusual query
optimization techniques available to us.

## GraphQL filters

The GraphQL filter object is how we restrict to the types of elements
we are concerned with retrieving. In GraphQL you really need to
specify two things: What kinds of documents you are interested in
retrieving, and what data is hanging off of those documents. That
makes our search inherently *two phased*.

Let's start with a simple schema with only people.

```json
{ "@type" : "Class",
  "@id" : "Person",
  "name" : "xsd:string",
  "dob" : "xsd:dateTime",
  "friend" : {"@type" : "Set", "@class" : "Person"}}
```

We can insert this as a one liner as follows:

```shell
$ echo '{"@type" : "Class", "@id" : "Person", "name" : "xsd:string", "dob" : "xsd:dateTime", "friend" : {"@type" : "Set", "@class" : "Person"}}' | terminusdb doc insert admin/people -g schema
Documents inserted:
 1: Person
```

We can insert some data quickly along the following lines from the CLI:

```shell
$ terminusdb doc insert admin/people
|: { "@capture" : "Jim", "name" : "Jim", "dob" : "1976-03-05T12:33:05Z", "friend" : {"@ref" : "Joe"}}
|: { "@capture" : "Joe", "name" : "Joe", "dob" : "1975-01-03T01:33:05Z", "friend" : {"@ref" : "Jim"}}
|: Documents inserted:
 1: terminusdb:///data/Person/f85a4ba5e70c9a814d22e9faaf1d35cfbc30836106bf1fecec7513a6af95bf74
 2: terminusdb:///data/Person/d63f7b8938da1a39d984a5c0cfcf5f0ca3cabe83e1f39691272da5ee556266c0
```

The resulting GraphQL schema will be automatically produced by
TerminusDB as follows:

```graphql
type Person {
  dob: String!
  friend(
    id: ID

    """skip N elements"""
    offset: Int

    """limit results to N elements"""
    limit: Int
    filter: Person_Filter

    """order by the given fields"""
    orderBy: Person_Ordering
    dob: String
    name: String
  ): [Person!]!
  name: String!
  id: ID!
}

input Person_Collection_Filter {
  someHave: Person_Filter
  allHave: Person_Filter
}

input Person_Filter {
  dob: DateTimeFilterInputObject
  friend: Person_Collection_Filter
  name: StringFilterInputObject
}

input Person_Ordering {
  dob: TerminusOrdering
  name: TerminusOrdering
}
```

## Optimizing Lookup

Now supposing we want to search by `dob` (date of birth). And suppose
we only want people older than 30. We can construct a filter which looks like:

```graphql
{
  Person(filter: {dob : {le : "1992-01-01T00:00:00Z"} }){
    name
  }
}
```

Currently we get a query object in rust that looks something like:

```rust
FilterObject {
  edges: [("terminusdb:///schema#dob",
           Required(Value(DateTime(Lt, "1992-01-01T00:00:00Z", "xsd:dateTime"))))] }
```

However, because of our lexically monotonic ID structure, we can
instead pre-compute ids when they exist with a data structure along
the lines of:

```rust
enum IdOrMiss {
  Id(u64),
  Miss(String),
}
```

This tells us if we were able to find a particular element in the
dictionary.

With this in hand, we can compile this to the much faster filter object:

```rust
FilterObject {
  edges: [(Id(1),
           Required(Value(DateTimeRange(7,8))))] }
```

Here, `Id(1)` is because we have `dob` as the first predicate in our
predicate dictionary. But what is the `DateTimeRange` element?

First, we look up the top of our interval, by asking the dictionary
for the first entry that is less than `1992-01-01T00:00:00Z`. This
gives us `8` as the first possible entry less than the date we
chose. Then we look for the end of the dates block. This can be done
similarly given that we prepend the type byte to the element, giving
the first acceptable value for the bottom end of our range.

Now, when performing lookup, we are literally only doing an integer
comparison with the results of the object array!

We can also use this to go backwards to the SP data to start an initial
iterator. With the range object, we have a good idea of the
cardinality of a given data element with only a couple of dictionary
lookups.

## Sorting the filter

We could also specify a slightly more constrained query such as:


```graphql
{
    Person(filter: {dob : {le : "1992-01-01T00:00:00Z",
                           gt : "1975-01-03T01:33:05Z"} }){
    name
  }
}
```

This filter means we're not interested in people who are fantastically
old (and therefore probably dead). When we compile it using our
range lookup we will get:


```rust
FilterObject {
  edges: [(Id(1),
           Required(Value(DateTimeRange(7,8)))),
          (Id(1),
           Required(Value(DateTimeRange(8,8))))] }
```

Our optimizer can now *fuse* these records, chosing the smallest
range. The smallest choice of a general query is a simple kind of
interval arithmetic game.

```rust
FilterObject {
  edges: [(Id(1),
           Required(Value(DateTimeRange(8,8))))] }
```

We now have only one value, and we simply have to lookup which subject
it belongs to and we're done!

## Filter or Iterator

The *initial iterator* choice is the most important one we have in
making our query fast. We can choose to make the initial iterator
either from the *type* of the object, which means finding the id range
for those elements of a type, or we can use the filter, to find
elements of something in the filter.

In both cases we want to pre-compute a range, and compare the size of
the range.

If we have a *key strategy* defined, then our IDs are guaranteed to
have been produced with a given prefix. This means we can quickly find
the boundaries of our subject id block to produce a subject
range. Once we have the subject range, can compare the size of this,
with the size of our filter ranges.

There is some trade off between going backwards on the object, versus
forwards on the Subject. We have a slightly faster path from S to P to
O than the reverse. So we need to weight the query plan for initial
iterator using this choice.

Once we have an initial iterator, we always use filters, in which case
we want to have the order of comparisons tightest first, so we reduce
the set quickly. We are now essentially in a scan of the remainder,
but all elements of the scan are integer comparisons. This of course
should now be fairly quick!

## WOQL next

Though I've started playing with this in GraphQL, these tricks are not
currently used in WOQL. My plan is to get them in place in GraphQL
first, and then back-port the strategies to WOQL to improve the
performance of our data log.

And of course, ultimately, I want all of the strategies compiled to
the LLVM :D
