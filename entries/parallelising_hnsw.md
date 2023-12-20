# Parallelising HNSW

HNSW (heirarchical small word graphs) were introduced in an excellent
and very readable paper [Yu A. Malkov,
D. A. Yashunin](https://arxiv.org/abs/1603.09320) which has given rise
to a large number of implementations which are at the core of many
popular vector databases.

The HNSW is a method of searching for vectors in a dataset which are
*close* to a given query vector. The basic idea of an HNSW is to make
a series of proximity graphs, organized in a stack which allows us to
zoom-in as we approach ever closer neighborhoods.

The top layer of the HNSW has relatively few elements, and we can
quickly find our best match in this layer greedily, and then we drill
down to the next layer down. Each layer down is an order of magnitude
larger, but contains all of the points from above. In this we can we
zoom in on an even closer alternative, and drill down another layer.

Finally, when we reach the bottom, we search around a bit for
candidates in our neighborhood and end up with an priority queue of
candidates ordered by distance.

## Advantages of the HNSW

The HNSW approach is essentially probabilistic. We try to find
candidates to match by choosing randomly, in the hopes that being
pretty well connected via super-nodes, we will not end up getting too
far from matches in our local minimum.

This makes the structure very appealing from the point of view of
incremental indexing. We can simply roll a die to see which layer we
are first inserted into, with a distribution putting everything in the
lowest layer, and increasingly seldomly putting it in ever higher
layers in a log-like way. This should, hopefully, be somewhat
self-balancing as new vectors come into the system we promote them to
supernodes of the tree for routing in a random manner.

This approach of creating tiered proximity graphs radically cuts down
on the computation which is necessary to do full distance calculations
over a set as new elements are added. Vector distance computations
over large vectors, such as exist in embeddings, can become
prohibitavely expensive very quickly when the number of vectors is large.

## Parallelising the approach

The algorithm outlined in the Malkov, Yashunin paper is however not
very ameanable to parallelisation. It relies on the previously
constructed index to search its way to good neighbors. There is a lot
of opportunity for contention over resources when parallelising it
naively (as the authors have found).

However, if we have a large batch job of vectors to add
simultaneously, there are very clear methods of building the index
faster using parallelism. This can play well with the above
incremental approach. In addition we can think of a mixed-incremental
batch job, which is somewhere intermediate between the two approaches.

### Constructing One Layer at a Time

The simplest, batch parallel approach assuming we are creating an
index *ex nihilo* constructs an HNSW *one layer at a time*.

We do this by first choosing a number of layers based on the input
indexing data *N*. This can be done with a calculation that takes the
log of N at a base M related to the number of elements in a
neighborhood.

Next we segment our input into overlapping slices, each one including
a prefix of the data of length `M^i` for each layer `i` starting with
`i=0`.  At each layer we use our single layer generation.

This approach of layer at a time generation is much more amenable to
parallelism, especially as the layer sizes increase. However, it is
also more sensitive to the order in which the data is ingested. For
this reason it is necessary to ensure a randomisation of the input
batch or you can end up with a very poorly constructed layer.

The (rusty) pseudocode might be written as:

```rust
let n = input.len();
let layer_count = input.log(n, M);
let layers = Vec::new();
for i in 0..layer_count {
  let size = M.pow(i);
  layer = generate_single_layer(layers, input[0..size])
  layers.push(layer)
}
```

### Single Layer Generation

This single layer generation consists of the following steps:

1. In parallel, iterate over all vectors in this layer, looking for
   their closest matches in the layer above.

2. Partition the set according to these super-neighborhoods. If we are
   the first layer to be constructed, this is simply one partition.

3. Go through each partition node by node, select candidate neighbors
   from this partition, and the next best partition, and the next best
   after that, with exponentially decaying probability. Truncate this
   to the neighborhood size (M). This will build up our initial
   neighborhood set of distances for this node.

4. Go through every node and make neighborhoods bidirectional (unless
   evicted as our distance exceeds the worst case within a
   neighborhood max size.

5. For each node, in parallel, write the neighborhoods into the
   neighborhood vector. This can be done in parallel since each
   neighborhood is independent and of fixed size.

### Bubble Up

Unfortunately the above algorithm can leave some things
unreachable. We found that on small data sets, the recall was quite
high, often exceeding .999, however once we reach the 10s of millions,
the algorithm can leave vectors orphaned, and recall can drop as below
0.90 (depending on the size of the search queue).

Luckily there is a strategy for dealing with the stragglers, using the
following algorithm:

1. Starting from layer zero, and proceeding upwards, find all points
   which are disconnected or distant from a super-node.

2. Segment these into neigbhorhoods and choose a representative
   super-node for promotion, which we add to the next layer up.

3. Repeat for the layer above.

Using this strategy ensures that all vectors are routable through
*some* path, though it's possible that greedy routing will lead to
some loss of recall despite.

### Search

The search mechanism works exactly as with the HNSW, except that we
don't need all of the layers to be constructed yet. We simply stop
searching when we've gotten to the last layer that has been
constructed. This allows us to construct neighborhoods by using the
pre-existing routing of the layers above.

### Incrementally Extending The Index

Building *ex nihilo* is not the only way you want to build an index in
practice. One of the big advantages to the HNSW algorithm is its
incremental nature. In fact, we can just reuse the original algorithm
to extend the structure and it works perfectly well.

However, there is another common mode of operation, which is a batch
update - where we have inserts, updates and deletes.

We can create a sort of half-way house between the two algorithms,
with either of the two as degenerate cases as follows:

1. Sample from an exponential distribution defined by the neighborhood
   size M, N times, where N is the number of new vectors. Create a
   count of these bins and use it as the prefix counts per layer of
   the vector.

2. Create any new layers (that are higher than previous) using the
   prefixes (if such exist) with the generate_layer algorithm above.

3. Use a modified version of the generate_layer algorithm as above
   performing all steps for only the new nodes.

4. Append the new nodes and new neighborhoods to the end of the
   existing layer.

## Conclusion

HNSW creates a very nice indexing structure, but the method of
construction does not need to be a trickle down approach. It is quite
possible to perform the steps in batches which enable much greater
parallelism to be exploited.

