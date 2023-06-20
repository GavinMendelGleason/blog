# Smaller is better: Ultra-compact graph representations for Big Graphs
## How we loaded 17 billion triples into TerminusDB on one machine

Recently at TerminusDB, at the behest of an active community member,
we decided to do an ingest of the OpenAlex Authors collection. This is
a pretty big data set. We found that after ingest, not only did we
have a database with 17 billion triples, but when we compared to
MongoDB, our database is smaller (only 212GB as compared to 280GB),
even though much better indexed. It also has the most compact triple
store representation we are aware of, coming in at less than 14 bytes
per triple for the tested dataset.

With TerminusDB you can search starting from subject, object or
predicate, in any direction, and get results quickly with an extremely
low memory footprint. A testiment to the utility of [succinct data
structures](https://en.wikipedia.org/wiki/Succinct_data_structure).

## Big Data is not always needed

When TerminusDB was first getting started, we did a project loading public
information about the Polish economy into a giant knowledge graph. The
project had a lot of custom code which would merge information into a
single compressed representation of a graph which could then be
efficiently searched. The dataset was around 3 billion triples.

This ingestion was really a custom solution. It had to be ingested as a
batch and could not be updated to correct information without starting
over from scratch, and took a very long time (over a day) to ingest on
a fairly large parallel computer with custom ingestion code.

Since that time, we focused on making TerminusDB more user friendly,
making it easier to get started by loading JSON documents which are
readable, and including schema checking to ensure that we don't suffer
from garbage data in the first place.

Since most databases that are in active use are less than 2GB in size,
this was probably the right decision. Very many real world use
cases do not require enormous data sets and ease of use is more
important.

## But I want a Gigantic Knowledge Graph!

However, sometimes, as with the original Polish economy use-case,
enormous datasets are precisely what we want. Recently one active
member of TerminusDB's community asked us if we could load the Authors
collection from the OpenAlex data-set, which incorporates an enormous
amount of information on scientific publishing.

TerminusDB's internals are designed to store very compact
representations of graphs, so we figured (with some back-of-the-napkin
calculations) that it might be possible to build a significant subset
of [OpenAlex](https://openalex.org/) into a single knowledge
graph... with a few changes to TerminusDB to facilitate doing so
without a custom ingestion. Our [ingestion of
OpenAlex](https://github.com/rrooij/openalex-terminusdb/blob/main/openalex_terminusdb/insert.py
) logic is writen in python.

## Parallelising Ingest

To parallelise the ingest, we created 500 seperate databases, each
responsible for one chunk of the data input. We segmented the data
input into 500 pieces. We then started 64 processes for ingest for one
database-chunk pair for each processor on a large 64 processor, 500GB
RAM machine. Every time one completed, we'd start a new process. This
way all processors were saturated with an ingest process until
completion.

The main part of the [ingest
script](https://github.com/rrooij/openalex-terminusdb/blob/main/openalex_terminusdb/insert.py)
is the following simple python code:

```python
def ingest_json(args):
    start = time.time()
    filename = args[0]
    number = args[1]
    schema = args[2]
    db_name = f"openalex_{number}"
    db = f'admin/{db_name}'
    with open(f"log/{db_name}.log", 'w') as f:
        subprocess.run(f"{TERMINUSDB_COMMAND} doc insert {db} -g schema --full-replace < {schema}", shell=True, stdout=f, stderr=f)
        subprocess.run(f'{TERMINUSDB_COMMAND} doc insert {db} < {filename}', shell=True, stdout=f, stderr=f)
        end_insert = time.time() - start
        f.write(f"\n\nEND TIME: {end_insert}\n")
```

This fires off a `terminusdb doc insert` command for a given database,
which we can form from an argument which we pass.  We can fire off
just the right number of these (for as many processors as we have)
with:

```python
    with Pool(args.threads) as p:
        # Ingest JSON
        p.map(ingest_json, args_process)
```

For our ingest, this process took about 7 hours to complete.

## Merging The Databases

In order to merge these 500 databases, we needed a new approach to
building a single union of a set of databases. We decided that we
would write a new *merge* operation (which we added to TerminusDB)
which could read any number of baselayers and merge them into a single
new base layer.

TerminusDB is immutable, so we perform updates by adding new layers
which include changes to the database (delta-encoding). The first such
layer is called a base layer.

Merging baselayers is less complicated as there is only one layer to
account for. Further, one can always acquire a base layer by first
performing a squash on a layer, to obtain a single new base layer, if
the database has a history of revisions. We figured requiring
baselayers in merge was a reasonable compromise for the interface.

Since we have so many databases, we don't want to have to specify them
all on the command line (in fact we might not even be able to) so we
take them on standard input.

The command is of the form:

```shell
$ echo "admin/db1 admin/db2 ... admin/dbn" | terminusdb merge admin/final
```

Where the databases are space separated list of all of the input
databases. That's all there is to it!

## Sparing use of Memory

Doing this 500-database-merge requires some careful attention to
memory. TerminusDB's memory overhead for a database is quite low,
despite having a highly indexed data structure allowing traversal in
every direction in the graph, due to the use of succinct data
structures.

Our final complete ingest, which represents 17 billion triples, is
only 13.57 bytes per triple!

To give an idea of how this ranks next to other graph databases, here
are some comparisons ([from
here](https://www.inf.utfsm.cl/~darroyue/papers/sigmod21.pdf), with
the caveate that they are working with a different dataset):

| Database   | Bytes per triple |
| ---------- | ---------------- |
| Ring       | 13.86            |
| Jena       | 85.83            |
| Jena LTJ   | 168.84           |
| RDF-3X     | 85.73            |
| Virtuoso   | 60.07            |
| Blazegraph | 90.79            |

This of course isn't the final word either, we have identified some
approaches along the way that might shrink this further, but it's
impressive none the less! Simply maintaining a table of triples of
64bit identifiers would be significantly larger.

The process of building our indexing structures however, was requiring
signficantly more memory than the final index. So we spent a bit of
time trying to make sure that we could do nearly everything by
*streaming* the input, lowering the amount of working memory required
to the absolute minimum.

## Streaming

We rewrote much of our layer writing code to take all the inputs as
streams. Base-layers are composed of a number of different segments,
including (node and value) dictionaries, and adjacency lists. These
are all *ordered*, meaning that it's possible to do the second half of
a merge sort (the conquere part of divide and conquere) in order to
merge them in a sorted order.

To make the comparison of all of the next 500 elements fast we use a
binary heap. This is initialized with the first 500 elements of each
stream, after which we pop off the least element and read another
element from that stream.

## Sorting

Finally building the indexes which allow quick lookup backwards from
objects to subject-predicate pairs, however, requires that we do an
additional sort.

As it turned out, doing a parallel sort over this using the tokio
routines in rust was just a bit too much to stay under 500GB of
memory.

Instead we had to chunk out pieces to sort, a bit at a time, and
recombine.

## A Giant Merge

The final layer is only around 212GB so fits very comfortably in a
500GB machine. With GraphQL you can query this data quickly. Being
able to fit so much into a single machine means you can get graph
performance which would simply be impossible with a sharding approach.

The merge step takes around 5 hours. So within 12 hours we can build a
~200GB database from JSON files to querable layers.

The entire process, when mapped out, looks something like this:

```
         JSON1     JSON2   JSON3    ....
           |         |       |       |
          DB1       DB2     DB3     DBN
            \        |      /       /
             \       |     /       /
              \      |    /       /
               \     |   /  _____/
               merge process
                    |
merge nodes + merge predicates + merge values
        \         |              /
         \        |             /
          \       |            /
           \      |           /
            \     |          /
             merge triples
                  |
              build indexes
                  |
              write to disk
```

## The Future

One of our central theses about graphs is that, due to the poor memory
locality of graphs and graph search, it's best if you can fit
everything into memory. That's why we haven't bothered with paging
approaches to our graphs (as opposed to our vector database). The
better the memory performance, the better the performance overall. As
soon as you're hitting network or disk to traverse links, you're
getting many orders of magnitude worse performance.

If you want more in a graph you should either:

1. Segment your graph logically - keep separate chunks in separate
   data products
2. Reduce the memory overhead

The first solution is really about data design. If you can break a
data product into separate data product components, then you can
reduce the total amount you need to have on a single machine. These
logical segmentations can't be done automatically but are very
important.

The second solution can be more automatic. TerminusDB is really
excellent in terms of memory performance as it stands. But we'd like
to be able to increase the amount we can fit in a single machine, even
above what we have now.

One thing that would reduce memory significantly is if we did not
index *all* backwards links, but only those that we know are going to
be used. This would require adding explicit indexing (or explicit
non-indexing) of predicates in the schema design. We estimate this
could be a savings of something like 10%-25% of memory.

Other alternatives include using alternative indexing strategies which
are also succinct. Perhaps an FM-index or a k^d-tree. Whether these
will be smaller in practice would require some experimentation.

In any case, we'll keep plumbing the limits with our motto in hand:
Smaller is better.
