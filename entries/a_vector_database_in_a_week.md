# We wrote a vector database in a week (in rust)

Vector databases are currently all the rage these days in the tech
world, and it isn't just hype. Vector search has become ever more
important due to artificial intelligence advances which make use of
*vector embeddings*. These vector embeddings are vector
representations of words embeddings,
[sentences](https://en.wikipedia.org/wiki/Sentence_embedding), or
documents which provide *semantic similarity* for semantically close
inputs by simply looking at a distance metric between the vectors.

The canonical example given was from
[word2vec](https://en.wikipedia.org/wiki/Word2vec) in which the
embedding of the word "king" was very near the resulting vector from
the vectors of the words "queen", "man", "woman" when arranged in the
following formula:

```
    king - man + woman ≈ queen
```

The fact that this works has always seemed amazing to me, but it works
even for fairly large documents provided our embedding space is of
sufficiently high dimension. With modern deep learning methods you can
get excellent embeddings of complex documents.

For TerminusDB we needed a way to leverage these sorts of embeddings
for the following tasks which our users were asking for:

* Full text search
* Entity resolution (finding other documents which are likely the same
  for deduplication)
* Similarity search (for related content or for recommender systems)
* Clustering

We decided to prototype using OpenAI's embeddings, but in order to get
the rest of the features we needed a vector database.

We needed a few unusual features, including the ability to do
incremental indexing, and the ability to do so on the basis of
*commits*, such that we know precisely what commit an index applies
to. This allows us to put indexing into our CI workflows.

A versioned open source vector database doesn't exist in the wild. So
we wrote one!

## Writing a vector database

A vector database is a store of vectors with the ability to compare
any two vectors using some metric. The metric can be a lot of
different things such as [Euclidean
distance](https://en.wikipedia.org/wiki/Euclidean_distance), [Cosine
similarity](https://en.wikipedia.org/wiki/Cosine_similarity), [Taxicab
Geometry](https://en.wikipedia.org/wiki/Taxicab_geometry) or really
anything which obeys the triangle inequality rules required to define
a metric space.

In order to make this *fast* you also need to have some sort of
indexing structure that allows you to quickly find candidates which
are already close for comparison, otherwise many operations are going
to require you to compare with every single thing in the database
every time.

There are many approaches to indexing vector spaces, but we went with
the HNSW (Hierarchical Navigable Small World) graph [See Malkov and Yashunin](https://arxiv.org/abs/1603.09320). HNSW is easy to
understand and provides good performance in both low and high
dimensions so is flexible. Most importantly there was a very clear
open source implementation which we found [HNSW for Rust Computer Vision](https://github.com/rust-cv/hnsw).

## Storing the vectors

Vectors are stored in a *domain*. This helps us to separate different
vector stores which will not need to describe the same vectors. For
TerminusDB we will have many different commits which all pertain to
the same vectors, so it's important that we put them all into the same
domain.

```
            Page
            0            1         2...
            ———————————————————————
Vectors:   | 0 [......]  2 [......]
           | 1 [......]  3 [......]
```

The vector store is page based, where each buffer is designed to map
cleanly to the operating system pages, but fit the vectors we use
closely. We assign each vector an index and then we can map from the
index to the appropriate page and offset.

Inside of the HNSW index, we refer to a `LoadedVec`. This ensures that
the page lives in a buffer currently loaded such that we can perform
our metric comparisons on the vectors of interest.

As soon as the last `LoadedVec` drops from a buffer, the buffer can be
added back into a buffer pool to be used to load a new page.

## Creating a versioned index

We build an HNSW structure for each (domain + commit) pair. If we are
starting a new index, start with an empty HNSW.  If we are starting an
incremental index from a previous commit, we load the old HNSW from
the previous commit, and then begin our indexing operations.

What is new versus what is old is all kept in TerminusDB, which knows
how to find changes between commits and can submit them to the vector
database indexer. The indexer only needs to know the operations it is
being asked to perform (i.e. Insert, Delete, Replace).

We maintain the indexes themselves in a LRU pool which allows us to
load on demand or use a cache if the index is already in memory. Since
we only perform destructive operations at commits, this caching is
always coherent.

When we are done and save the index, we serialize the structure with
the raw vector index as a stand in for the `LoadedVec` which helps to
keep the index small.

In the future we would like to use some of the tricks we have learned
in TerminusDB to keep *layers* of an index around, such that new
layers can be added without requiring each incremental index to add a
duplicate when serializing. However, so far, the indexes have proved
small enough compared to the vectors we are storing that it has not
mattered much.

NOTE: While we currently do incremental indexing, we have yet to
implement the delete and replace operations (there are only so many
hours in a week!) I've read the literature on HNSW and it seems that
it is not well described as yet.

We have a design for this which we think will work well with HNSW
which we want to explain in case any technical people have ideas:

* If we are in an upper layer of the HNSW, then simply ignore the
  deletion - it should not matter much as most vectors are not in
  upper layers and then ones that are, are only for navigation
* If we are in the zero layer but not in an above layer, delete the
  node from the index, while trying to replace links between all
  neighbours of the deleted link according to closeness.
* If we are in the zero layer but also above, mark the node as
  deleted, and use for navigation but do not store this node in the
  candidate pool.

## Finding embeddings

We use OpenAI to define our embeddings, and after an indexing request
is made to TerminusDB, we feed each of the documents to OpenAI which
returns lists of float fectors in JSON.

However, it turns out that the embeddings are quite sensitive to
context. We tried initially just submitting TerminusDB JSON documents
and the results were not fantastic.

But we found that if we define a GraphQL query + Handlebars template,
we can create very high quality embeddings.  For `People` in Star
Wars, this pair, which is defined in our schema, looks like:

```json
{
    "embedding": {
        "query": "query($id: ID){ People(id : $id) { birth_year, created, desc, edited, eye_color, gender, hair_colors, height, homeworld { label }, label, mass, skin_colors, species { label }, url } }",
        "template": "The person's name is {{label}}.{{#if desc}} They are described with the following synopsis: {{#each desc}} *{{this}} {{/each}}.{{/if}}{{#if gender}} Their gender is {{gender}}.{{/if}}{{#if hair_colors}} They have the following hair colours: {{hair_colors}}.{{/if}}{{#if mass}} They have a mass of {{mass}}.{{/if}}{{#if skin_colors}} Their skin colours are {{skin_colors}}.{{/if}}{{#if species}} Their species is {{species.label}}.{{/if}}{{#if homeworld}} Their homeworld is {{homeworld.label}}.{{/if}}"
    }
}
```

The meaning of each field in the `People` object is rendered as text
which helps OpenAI understand what we mean, providing much better
semantics.

Ultimately it would be nice if we could *guess* these sentences from a
combination of our schema documentation and the schema structure,
which is probably also possible using AI chat! But for now this works
brilliantly and does not require much technical sophistication.

## Indexing Star Wars

So what happens when we actually run this thing? Well, we tried it out
on our Star Wars data product to see what would happen.

First we fire off an index request, and our indexer obtains the
information from TerminusDB:

```
curl 'localhost:8080/index?commit=o2uq7k1mrun1vp4urktmw55962vlpto&domain=admin/star_wars'
```

This returns with a task-id which we can use to poll an endpoint for
completion.

The index file and vector files for the domain `admin/star_wars` and
the commit `o2uq7k1mrun1vp4urktmw55962vlpto` come out as:

`admin%2Fstar_wars@o2uq7k1mrun1vp4urktmw55962vlpto.hnsw`

and

`admin%2Fstar_wars.vecs`

We can now ask the semantic index server about our documents at the specified commit.

```
curl 'localhost:8080/search?commit=o2uq7k1mrun1vp4urktmw55962vlpto&domain=admin/star_wars' -d "Who are the squid people"
```

We get back a number of results as json which look like:

```json
[{"id":"terminusdb:///star-wars/Species/8","distance":0.09396297}, ...]
```

But what is the embedding string we used to produce this result? This is how the text rendered for the `Species/8` id:

```json
"The species name is Mon Calamari. They have the following hair colours: none. Their skin colours are red, blue, brown, magenta. They speak the Mon Calamarian language."
```

Amazing! Notice that it never says squid anywhere! There is some
pretty amazing work being done by our embeddings here.

Let's have another go:

```
curl 'localhost:8080/search?commit=o2uq7k1mrun1vp4urktmw55962vlpto&domain=admin/star_wars' -d "Wise old man"
```

```json
"The person's name is Yoda. They are described with the following synopsis:  Yoda is a fictional character in the Star Wars franchise created by George Lucas, first appearing in the 1980 film The Empire Strikes Back. In the original films, he trains Luke Skywalker to fight against the Galactic Empire. In the prequel films, he serves as the Grand Master of the Jedi Order and as a high-ranking general of Clone Troopers in the Clone Wars. Following his death in Return of the Jedi at the age of 900, Yoda was the oldest living character in the Star Wars franchise in canon, until the introduction of Maz Kanata in Star Wars: The Force Awakens. Their gender is male. They have the following hair colours: white. They have a mass of 17. Their skin colours are green."
```

Incredible! While we do say "oldest" in the text, we don't say "wise" or "man"!

Hopefully you can see how this could be helpful for you in getting
high quality semantic indexing of your data!

## Conclusion

We have also added endpoints to find neighbouring documents, and to
find duplicates which searches over the entire corpus. The later was
used on some benchmarks and has performed admirably. We hope to show
the results of some of our experiments here soon.

While there are really great vector databases out there in the wild,
such as Pinecone, we want to have a sidecar that integrates well with
TerminusDB and which can be used for less technical users who care
about *content* primarily and are not going to be spinning up their
own vector database.

We are really excited about the potential of this and we will release
all of the code open source after we clean it up a little so as not to
be too embarrased by some of the error handling :D (again, only so
much can be done in a week!)


