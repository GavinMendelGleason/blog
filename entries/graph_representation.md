# TerminusDB internals part 1: Smaller, Faster, Stronger

When we were designing TerminusDB we wanted to make a graph database
which would allow curation of large complex graphs where the search
*mode* (we'll talk a bit about modes in a minute) was not yet
known. In playing with some large graphs (for instance a database of
all Polish companies since the mid 1990s) we came to the following
conclusion:

* Graphs, due to their highly interconnected nature, are hard to
  segment
* This makes paging, and network communication, potentially very
  costly when edges are traversed across segments
* Main memory size can accomodate *many* very large graphs even for
  enterprise scale problems.

Point two is especially hard to overcome. If you start paging in a
graph, because of the very random nature of graphs, we can get
extremely varied pages. This could easily lead to thrashing. Since
disk access times on fast SSD are one to two orders of mangitude
slower than DRAM we're talking perhaps 100 times worse
performance. For networks this climbs to three orders of mangitude.

These considerations let us to speculate that we could build an
in-memory graph database if we were careful to ensure that we were
sparing with memory use.

In addition to this in-memory advantage, having low memory overhead
has additional benefits for *collaboration*, in that we can send
deltas around in a compact format.

Size matters, and smaller is better.

It's important to note, that by *in-memory* we mean that there is no
database paging, we do not move parts of the database into and out of
memory. It does not mean that we are not writing to disk. TerminusDB
is both ACID and persistent, so there is no risk of data loss for
completed transactions.

## Relational indexing

In typical databases, we ask questions of relations. Relations are
typically built from tables of facts togther with some operations
which allow us to join relations. In addition we often specify
particular projections of these relations by asking for certain
constraints to hold.

```SQL
SELECT Orders.OrderID, Customers.CustomerName, Orders.OrderDate
FROM Orders
INNER JOIN Customers ON Orders.CustomerID=Customers.CustomerID
WHERE Orders.OrderDate > 2010-04-01;
```

> Create a new relation by joining two relations, Customers and Orders
> on the customer ID field and project to a relation in which all
> dates are more recent than 2010-04-01 using the WHERE restriction.

In order to make these queries effecient we will often introduce
*indexing* on the fields which we want to join or restrict. If we do
not do this, then we might have to *scan* through each `CustomerID` in
the one table to see if it is in the second table. A scan means we
look at each record. If the size of `Cusomers` is `n`
(`|Customers| =n`) and `Orders` is `m` (`|Orders| = m`), then this
would result in a number of operations on the order of
`n*m`. Similarly, if we have not indexed the date field, we will have
to compare the date for each record that we produce.

With an index, we can make access *log like*, by creating a tree which
makes it possible to access the data without a scan. Our date
restriction will allow us to *start* our search in the right place in
the relation which will make our effective `m` smaller (which we might
call` m'`, and the order of the problem shrinks to `n * log(m')`.

If `n` and `m` are big numbers, then this is a big deal. If we have
more than one join, we can easily see how unindexed relations could
lead to numbers which spiral out of control and are effectively
impossible to query.

## Graph Databases

In a *graph database*, we remove a good deal of this complexity by
having exactly one type of relation, the edge. And since we want to be
able to explore the graph very freely, we will need to index
*everything*. This will let us join to create paths through the graph.
Everything is a *self* join of a single relation in a graph, the edge
relation.

For a search we can think of querying our relation in any of the
possible *modes*.  A *mode* means specifying what we know, versus what
we need to look for. We write a `-` for anything we don't know, and a
`+` for anything we do. We can write our modes as a triple such as
`(+,+,-)`

Graph modes include:

```
(-,-,-)
(-,-,+)
(-,+,-)
(-,+,+)
(+,-,-)
(+,-,+)
(+,+,-)
(+,+,+)
```
...so eight query modes that we might want to support.

Now, some of these might be more common than others, and therefore we
might want to make them faster. We'll talk about that later when we
get into the guts of our index.

By way of example, let's think of a data point named `Joe`. If we
wanted to see everything which `Joe` is connected to, we might say (in
WOQL):

```javascript
let v = Vars("p","x");
triple("Joe", v.p, v.x)
```

This has mode `(+,-,-)`.

If we wanted to see everything that was connected to everything that
Joe was connected to, we might say:


```javascript
let v = Vars("p","x","q","y");
and(triple("Joe", v.p, v.x),
    triple(v.x, v.q, v.y))
```

Here we start with `(+,-,-)` and it might at first appear that we have
`(-,-,-)` for our second search. However, we can get the results back
from the first search to reduce this to `(+,-,-)` meaning we can
consider a projection of the relation speeding things up considerably.

## Sparing Use of Memory

Doing all of this indexing makes query very flexible. We can weave
relationships out of the graph and instead of having all sorts od
different tables with different shapes we can just have one big table.

This is also potentially very fast if everything is indexed and we can
do restrictions quickly.

But it also threatens to make things very big. How many indexes will
we need to build all of this?  The mode `(-,-,-)` is just the whole
relation so doesn't need an index. For `(+,+,+)` we can probably
permit ourselves a scan on one of the fields as we've already
restricted heavily. What can we get away with?

And indexes are *trees* which help us get log like behaviour out of
our searches. And trees often mean adding lots of pointers. Pointers
can actually end up being a substantial amount of the size of an
indexed database as we create the many layers of the tree.

And if our database grows too great in size, we threaten to hit the
size of main memory. We can often add more memory, but the more
parsimonious our representation, the more databases will fit into a
given memory size. It therefore pays handsomly to be small.

Hoewver, we can solve this problem with a family of datastructures
known as *succinct data structures*. These try to keep fast, log-like
access modes available, while keeping storage space close to the size
of the data itself.

### The Dictionary

The first point of entry is the dictionary. Given a *name* (such as
`Joe`) we want to come up with an internal *identifier* which consists
of an unsigned 64 bit integer. This will be our internal name for
`Joe`, which takes a fixed and relatively small amount of space.

Essentially we need a table which goes from integers to names and back
again.

In TerminusDB we do this with a datastructure known as a [Front coded
dictionary](https://en.wikipedia.org/wiki/Incremental_encoding). This
structure is particularly good when your identifiers are likely to
share prefixes. Since all named identifiers in TerminusDB are
[IRIs](https://en.wikipedia.org/wiki/Internationalized_Resource_Identifier).

If we have a block size of eight entries, a block might look as follows:

| Input     |	Common prefix   | Compressed output |
|-----------|-------------------|-------------------|
| myxa      | None              | 0 myxa            |
| myxophyta | 'myx'             | 3 opyta           |
| myxopod   | 'myxop'           | 5 od              |
| nab       | None              | 0 nab             |
| nabbed    | 'nab'             | 3 bed             |
| nabbing   | 'nabb'            | 4 ing             |
| nabit     | 'nabit'           | 3 it              |

The basic idea is to store deltas between strings, allowing us to use
less space to store all of our strings than would be required with a
straight dictionary. The dictionary is organized in *blocks* with each
block starting with a full, uncompressed entry, and all subsequent
entries in the block are allowed to refer back to any element in the
block to reuse parts of previous elements.

As you can see, we get substantial compression here by reusing prior
entries. But we have to start over with no common prefix every block
size, and if we share nothing, we get a slight disimprovement (as we
have to store a zero offset as a prefix to our compressed output).

This gives reasonably good compression for typical IRIs, often between
40 and 80%.

To get our ID, we simply need to know numerically which entry we are
in the dictionary. Since we store the dictionary entries lexically
sorted, we can find a specific entry using binary search. First we
look up `Jim` in the middle of the dictionary, if the first entry in
our middle block is bigger than `Jim` we scan through the block, if
we're bigger than every entry of the block, we search in the middle of
the second half of the dictionary. If we are less than `Jim` we can
search in the first half. Wash-rinse-repeate we have access to our
index using an access mode that guarantees we get our answer in a log
of the size of the dictionary `O(log(n))`.

And going in *reverse* we can find the dictionary entry for a given
integer in `O(1)` (constant) time. We do this by keeping around an
index of block-offsets so we can quickly find which block we are
in. The block offsets themselves are stored in a compressed data
structure which has constant time access (in our case a Log Array, but
it could be another data structure such as an [Elias-Fano
encoding](https://www.antoniomallia.it/sorted-integers-compression-with-elias-fano-encoding.html)).

For our graphs we have three dictionaries. One for nodes, which form
the Subjects/Objects, one for Predicates or edges and one for
values.

The first shared dictionary allows us to use the same subject id for
an object which is convenient in following chains. Predicates, or the
edge name, is treated specially as it is seldom necessary to look them
up in a chain, so they can reside in their own name space, can can use
an overlapping range of integer ids with the nodes.

We also represent our *data* in a value dictionary. These are
represented as a specific offset *above* the numbers used for nodes,
which we add to the number of our dictionary entry to translate to and
from id-space.

Note, that to store data effectively here using a dictionary with
front encoding, it is important to store *everything* lexically. We'll
address lexical encodings of data types in another future blog.

### The Adjacency List

Once we have our id, we need to see how we are connected. Let's
imagine we are starting with `Joan` and our access mode is `(+,-,-)`.

Perhaps there are only two people in our database for the moment, and
our graph looks like this:

```
Jim -address-> "12 Mulberry Lane"
Jim -dob-> "1963-01-03"
Jim -friend-> Jim
Jim -friend-> Joan
Jim -name-> "Jim-Bob McGee"
Joan -address-> "3 Builders street, house number 25, apartment number 12"
Joan -dob-> "1985-03-12"
Joan -name-> "Joan Doe"
```

Our node dictionary is `{'Jim':1,'Joan':2}` our predicate dictionary
is: `{address:1,dob:2,friend:3,name:4}` and our value dictionary is: `{'12
Mulberry Lane':1,'3 Builders street, house number 25, apartment number
12':2,'1963-01-03':3,'1985-03-12':4,'Jim-Bob McGree':5,'Joan
Doe':6}`. Note that we still have to apply an offset of 2 (the size of
our node dictionary) to our value dictionary to get back and forth
between id space and our dictionary entry number for values. Also, all
dictionaries are 1 indexed rather than zero. We will treat zero as a
special identifier representing emptiness.

To find out what predicates are associated with `Joan` we need to look
them up in an *adjacency list*. Internal to TerminusDB this is
represented with a pair of data structures. A log-array and a
bitindex. The log array stores the ids of our associated predicates,
and the bitindex tells us which predicates are associated with which
subject.

For instance, to look up `Joan`, we first look up the second entry
(Joan's id is 2). This is done with our succinct data structure, the
bitindex.

### The Conceptual structure

Our bit index looks conceptually as follows:

|Subjects| Subject Id | Bit Index | SP Array |
|--------|------------|-----------|----------|
| Jim    |  1         |  1        | 1        |
|        |            |  1        | 2        |
|        |            |  1        | 3        |
|        |            |  0        | 4        |
| Jane   |  2         |  1        | 1        |
|        |            |  1        | 2        |
|        |            |  0        | 4        |

The bit index tells us what subject is associated with which entry of
the SP Array (using *select*), and the SP Array holds the predicate id
which is available to that subject. The *index* of the SP Array is
conceptually an Subject-Pair identifier, refering to a concrete
subject (available by asking the *rank* of the bit-index, the
population count of 1s at the specific offset) and simply by returning
the value of the SP Array at that index.

Making the *rank* and *select* operations fast for bit-indexes is its
own subject which we will talk about in a moment. For now it's just
important to know why we want them to be fast.

We have the following the concrete representations:

```
SP BitIndex: 1110110
SP Array: [1,2,3,4,1,2,4]
```

We can ask for the `(subject_id - 1)`th 0 of our bit-index to find out
which section of the bit index we are interested in. So for instance,
if we want to know what Jane is connected to, we look up the index of
the 1st 0, add one, and we find our subject-predicate starting
index. In this case that index is 5.

We can then iterate over this vector up until we reach the next 0 in
our bit index, and these are all the SP pairs associated with Jane. In
other words, the indexes into the SP array of 5 through 7 are
associated with the Subject 2, and have predicates 1, 2 and 4.

```
                 Jane's bits in the bit index
                      | | |
SP BitIndex:  1 1 1 0 1 1 0
SP Array:    [1,2,3,4,1,2,4]
                      | | |
                      Jane's associated predicates:
                        address (1), dob (2), name (4)
                        ...but not friend(3)
```

Now, supposing we have an SP index, how do we find the object
associated? Since each predicate can point to multiple objects, we
will use the same trick again. In our case we only have one object for
each element of the SP Array, Here, we use the Object Log Array.

```
SP BitIndex:  1 1 1 0 1 1 0
SP Array:    [1,2,3,4,1,2,4]
O BitIndex:   0 0 1 0 0 0 0 0
Object Array [3,5,1,2,7,4,6,8]
```

Ok, so what object is associated with Jane's name? First, we look up
the name to see that it is predicate id 4. We know that Jane starts at
index 5, so we can scan through the SP vector until we get a 4. We
remember this index, which is 7.

We can now ask for the index of the (7-1=6)th zero in the Object
BitIndex and add one to get 7. The number at this index is 8. Since `8 > 2`,
the max number for nodes, we know this is a value. We can subtract 2,
get 6, and look up the number in the value dictionary, to retrieve
"Joan Doe" (6). Success!

Notice that there is *one* 1 in the Object BitIndex. This corresponds
with the fact that the predicate friend (3) has two elements in the
Object Array. The 3 in the SP array corresponds with friend. It is at
index 3. When we look up the (3-1)th zero in the Object index we get a
1, we add one to get 2, see that there is a 1 in this position, and
know that there is more than one value. We count the number of values
(number of ones + 1), and get that there are two values. We can now
iterate in the Object arroun from the index 3 to the index 4.

The answers here are 1, and 2, both are less than or equal to our node
count, so we are nodes. We can look up the node names in our
dictionary and find it is Jim, and Joan!

### Reversal of fortune

But how do we go backward from object id to SP? We need another data
structure here. In this case it will be the inverted index of the
Object Array.

```
O_SP BitIndex:  0 0 0 0 0 0 0 0
O_SP Array     [2,2,0,5,1,4,3,6]
```

If we know an object Id, for instance, we want to find the object
associated with the name "Joan Doe" we simply look it up in the Object
dictionary, get an id of 6, add two (the offset for nodes) to
get 8. Now we look up where we are in the Object to SP bit index, by
asking for the (8-1)th 0, and add 1 and find that we are at SP index
of 6. If we look up this index (6) in the SP_array, we find that it
corresponds with name (4), and we can count the number of zeros in the
SP BitIndex up to this point to our Subject identifier which is 2, the
id of Jane!

### Bit Indexes

Our bit index lets us perform two operations, `select` and `rank`. We
were using them above informally to find the ith zero
(`my_array.select(0,i)`), and the population of zeros up to an index
(`my_array.rank(0,i)`).

Of course we could implement these operations trivially by scanning
through a bit vector, but that would take time proportional to the
number of elements `O(n)`. To do it faster we need to keep some
additional information.

We can see here that our implementation in rust keeps around some
book-keeping, and a `BitArray`, and each of blocks and sblocks is
represented using a `LogArray`.

```rust
pub struct BitIndex {
    array: BitArray,
    blocks: LogArray,
    sblocks: LogArray,
}
```

The bit array just contains the bits themselves. The blocks however,
keep track of population counts so we know the rank, and the super
blocks keep track of super population counts.

For instance, for the bit sequence used above, blocks of size 3 and
super blocks of size 6, we might have:

```
BitArray:  1 1 1 0 1 1 0
Blocks:   |  3  |  2  |  0  |
SBlocks:  |     5     |     0    |
```

To find the number of 1s at index j, we simply make the calculation of
the number of bits up to j in a block, and use the population counts
from blocks and superblocks.  In rust pseudocode:

```rust
let array = BitArray::from_bits(0b1110110);
let block_index = j / 3;
let sblock_index = block_index / 2;
let block_rank = blocks.sum_rank(blocks_index);
let sblock_rank = sblocks.sum_rank(sblock_index);
let bits_rank = array.sum_rank([block_index * 3],j);
sbock_rank - block_rank + bits_rank
```

Here the `sum_rank` function just counts the rank as a sum from the
last superblock, last block or last bit sequence. This can be
considered a constant time operation as each of these sizes is fixed
and though we have to compute all three, three constant time
operations is also constant.

The rank of index 4 is now calculated with `block_index = 1`,
`sblock_index = 0`. Therefore we take 5, subtract 2, and add 1, to
get 4. Indeed the correct rank. The number of zeros is the index + 1
minus the population count of 1s, or 1.

So rank is done, but what about select? It turns out we can implement
select by doing a binary search with rank. Recall that select finds the
`ith` zero or one. To implement this we can simply start from the mid point, look at the
rank, and keep subdividing until we get a select that matches. Since
rank is `O(n)`, this means that select, implemented in this way is `O(log(n))`.

### Conclusion

If you've made it this far then congratulations, you've a lot of
stamina! What you've learned so far is enough to make a graph with
flexible query modes that can be used as a foundation for a database.

All of these succinct structures are tightly packed and therfore
optimised to be *write once*, *read often*. They aren't well suited to
mutable updates. In order to get these mutations, we'll need some more
machinery. In my next blog, we'll dig into how that works.
