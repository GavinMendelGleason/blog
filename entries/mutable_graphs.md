# TerminusDB internals part 2: Change is gonna come

In [Part 1 of TerminusDB internals](./graph_representation.md) we
looked at how to construct a graph using succinct data
structures. Succinct data structures are nice and compact, but they
are not intrinsically *dynamic*. That is, you can't mutate them
directly.

To see why it would be hard to mutate, imagine we have a dictonary:

```
Jim
Joan
```

And we want to add `Jack`.

```
Jack
Jim
Joan
```

This entry shifts all of the indexes of everything by one. Every entry
in all of our arrays which represent our graph is now wrong. Directly
mutating the data structures is clearly not the easiest way to
proceed.

## Immutable updates

There is another strategy however. Instead of mutating, we can build
up a *delta*. This *delta* is actually two new graphs. One which adds
some number of edges, and another which deletes them.

The engineering team calls these *positive and negative planes*, since
it's easy to imagine them layering over the previous database. And the
original plane is called the *base plane*, since it is only ever
positive.

This trick is actually quite similar to the way that [Multi-Version
Concurrency
Control](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)
works, and can be used to implement not only immutable updates, and
versioning, but also concurrency control.

However, now, when a query comes in, we need to do something a bit
more elaborate to resolve it. And what precisely we do depends on the
mode.

If we are searching for a triple, with some aspects unknown, for
instance the mode `(+,-,-)`, we need to cascade downwards through our
planes searching for it.

For instance, the search for a triple:

```javascript
let v = Vars("p","x");
triple("joe", v.p, v.x)
```

In a database which has experienced two updates


```
|      Plane 1             |        Plane 2           |     Plane 3           |
| +(joe,name,"Joe")        | +(joe,dob,"1978-01-01")  | +(joe,name,"Joe Bob") |
| +(joe,dob,"1979-01-01")  | -(joe,dob,"1979-01-01")  | -(joe,name,"Joe")     |
```

Here we will start at plane 3, fall back to plane 2, then the base
plane, and then bubble back up.

```
|      Plane 1             |        Plane 2           |     Plane 3           |
| +(joe,name,"Joe")        | +(joe,dob,"1978-01-01")  | +(joe,name,"Joe Bob") |
| +(joe,dob,"1979-01-01")  | -(joe,dob,"1979-01-01")  | -(joe,name,"Joe")     |
          ||                         ||                      ||
          ||                         ||                      \/
          ||                         ||               (joe,name,"Joe Bob") =>Answer
          ||                         \/
          ||                   (joe,dob,"Joe Bob")    ======================>Answer
          \/
    (joe,name,"Joe")  ======================================> X
    (joe,dob,"1979-01-01") ==========> X
```

The two elements in the base plan get cancelled by deletions on the
way up. They can't be answers since they aren't there anymore. This
approach works for arbitrary modes, however, as the stack of planes
gets large, it starts to get slow. The performance degrades linearly
as a function of the number of transactions which have been performed
on the database. In practice you can often start to *feel* things
slowing down when the stack is on the order of 10 transactions.

## Delta Rollup

Hence we need to *rollup* some of these deltas. Essentially we need to
do a delta compression, create a new plane which represents some
number of intermediate planes, but in which we've cancelled everything
which was ephemeral (such as the two triples in the base plan).

This delta rollup, sits along side our previous planes, as an
*equivalence* layer. All of the deltas are kept, as this allows us to
time-travel, and to push or pull commits to other servers, but we
introduce a pointer from our layer saying we have a faster way to
query. Should any query come in, they should preferentially take the
delta rollup layer instead.

However, we don't need to *always* roll-up everything all of the
time. In addition, since the operation takes some time there is a
danger that rollups might occur too late to matter if expect to have a
rollup at every layer.

Instead we want to try to make sure that our rollups are *log-like*,
in their occurance.  Basically we want to merge more things deeper
into the past, as these will be stable, and progressively fewer as we
get closer to the present.

For instance, we might have the following rollups for some sequence of commits:


```

 _____c1-4______  __c4-6_
/               \/       \
c1 - c2 - c3 - c4 - c5 - c6 - c7
                              |
                              main
```

Here we keep a rollup for the orders 4, then 2, then 1. As we go back
into the past the number of rollups gets smaller, and the total number
of rollups we expect to see, and hence have to traverse is now
*log-like* as the number of commits grows. For instance, as we
increase the number of commits we get:

```

   _______c1-8__________________
  /                             \
 _____c1-4______  __c4-6_        \   ____c8-c11__
/               \/       \        \ /            \
c1 - c2 - c3 - c4 - c5 - c6 - c7 - c8 - c9 -c10 -c11 -c12
                              |
                              main
```

In addition, because of our log-based approach, when rolling up the
c1-8 commits we are only have to look at 4 layers, rather than 8. This
speeds up the merge operation on a running basis, and we will have a
relatively small number of layers to query, in fact in both cases we
have 3.

If you're paying close attention you might see there are potential
optimisations in the representation of negatives. You could tomb-stone
a particular SP pair for instance, if there is cardinality zero, and
save some traversals. We have not implemented this yet in TerminusDB,
but we would like to do some experiments with it in the future.

## Even the Graphs have Graphs

Since we have this commit structure to our graph, access to a graph
comes in through the *head* of the graph. We need to know what is the
most recent current graph.

In TerminusDB, our graphs are schema checked, and our schemata
themselves are stored in a graph. So a typical data product is
actually a number of graphs:

* A Schema Graph
* An Instance Graph
* A Commit Graph
* A Repo Graph

In addition we have a central graph, the *System Graph* which stores
which data products exist and some properties about them that are
*external* to the data product.

The combination of schema and instance graph are stored in the commit
graph. This associates a commit with both its current instance graph
and its current schema graph. The *head* of a given branch points to
the most recent commit.

When we open a data product for reading or writing, we look up the
branch in the commit graph, get the latest head, and then open the
associated layers for querying.

The Repo graph stores information about local and remote repositories,
and which commit graphs are associated with them. This is used for the
push/pull type repository collaboration features.

## Transactions

In order to orchaestrate all of these graphs we need to be a bit
careful about the order in which we perform operations in order to
make sure that everything is properly atomic.

The operation order is something like this:

1. We perform a query, and if there are any mutations we create a
   *builder* recording all insertions and deletions.
2. We update the commit graph, advancing the branch head, and update
   the repo graph, advancing the repo head to point to the commit
   graph id, creating builders for them as well.
3. Once the query has completed successfully, we transform each of these
   builders into a *validation object*. A validation object checks any
   outstanding schema checks which could not be quickly performed
   during the query. For instance referential integrity checking which
   requires that we have everything completed before we can check that
   it holds.
4. We write all of the validated objects to disk, synchronising on
   completion of all layers.
3. We set the label file of the database to point at the most advanced
   repository identifier.

If someone has gotten in and changed the label file before us, we use
optimistic concurrency and re-execute the query. This gives us our
acid properties.

## The Journey Forward

One might notice however that this is a bit too strict. It would be
nice if we could check to see if some weaker form of isolation could
be maintained so we don't have to re-run the query. Instead we might
be able to simply place our current transaction on top of the previous
one without running anything again.

In order to do this we need a concept of an isolation level, for
instance snap-shot isolation were we could maintain a read-set which
specifies which things must be stable based on what we read during the
query.

We could also be a bit more clever about the way we deal with garbage
created during transactions. Currently we leave around layers that
we've written even when the transaction fails. This can be cleaned up
with a garbage collection process, but it's probably better if we
don't write it in the first place.

We are keen to get these improvements into a future release of
TerminusDB.

In the next blog on TerminusDB internals, we'll look at data layout,
search and compression. If you've made it to the bottom of this post,
then you're probably waiting for this next one with bated breath.
