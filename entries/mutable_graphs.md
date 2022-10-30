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

## Even the Graphs have Graphs

The database keeps metadata about all of these layers in its own
graph, the *commit graph*. The commit graph stores the ...

Repo Graph

##
