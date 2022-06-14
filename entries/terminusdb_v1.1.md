# TerminusDB v10.1.0: The Mule

We have recently release TerminusDB v10.1 which we have labelled The
Mule. We have added a number of technical features, and performance
enhancements, but most of these are all pieces on the way to realising
our broader vision.

Our aim is to create a distributed database for knowledge graphs. One
in which you can incrementally grow segments of the graph (data
products) over many nodes creating individual high quality products
that are linked at the boundaries (in a manner not entirely unlike how
object code linking works) and can be shared between the nodes. We
want a truly distributed, multi-party, scalable knowledge graph
management system.

To facilitate this, we have made a number of somewhat unusual
technical choices which diverge from standard database technology.

* The database is immutable, with alterations to the database stored
  as deltas.

* We use succinct data structures to make sure our updates have
  a compact representation, facilitating sharing between nodes, and
  loading of extremely large graphs into memory, which avoids
  thrashing (something which graphs are particularly good at).

* We keep metadata in a *commit graph* about histories for each data
  product at a node. and the data which has changed.

* We share our changes and histories by sharing these commit graphs
  along with the changes they refer to.

* We structure our units as *objects* (with a natural JSON
  representation) with links (somewhat analogous to web-pages), butwe
  store and can query everything as a graph.

* Distributed transactions are "slow", and we manage them in a fashion
  analogous to git, with merges and conflict resolution as the approach.

* Search is provided using a datalog query engine which makes graph
  search convenient.

Not everything that is necessary for real industrial scale production
of the distributed knowledge graph is there yet. We still have
important steps on our roadmap before this achieved.

However, we're starting to become very strong in the creation of
individual domain focused knowledge graphs. The technical improvements
which have made this convenient include: document diff, type
inference, capture ids, document UI, and unconstrained JSON fields.

## Diff

In order to have the "slow" distributed transactions mentioned before,
which allow us to modfiy graphs using rebase, cherry pick, merge etc
for strutured documents, we really need to have a diff
algorithm. Previously, diffs in TerminusDB were purely a result of
differences in the set of triples. This was awkward from the point of
view of object identity, which is more commonly how people think about
their data.

The diff interface with TerminusDB now provides uses JSON documents as
the unit of analysis. It performs a tree structured diff on
dictionaries, and a list diff on lists. All datatypes are currently
considered atomic, but we would like to introduce diffs at the
datatype level in the future (for instance for strings).

```javascript
val x = {
  '@id': 'Example/a',
   a: 'pickles and eggs'
}

val y = {
  '@id': 'Example/a',
   a: 'vegan sausage'
}

# diff between x and y
{
  '@id': 'Example/a',
   a: {
          '@after': 'vegan sausage',
          '@before': 'pickles and eggs',
          '@op': 'SwapValue',
      }
}
```

## Capture Ids

In TerminusDB, transactions always generate data as a single function
of the current state of the world. There are no intermediate states
available in a query.

This presents a bit of a problem if I want to add a link to a document
which isn't there yet. Or perhaps we want to add two documents which
refer to each-other.

```json
{ "@type" : "Person",
  "name" : "Joe",
  "friends" : ?Jim }

{ "@type" : "Person",
  "name" : "Jim",
  "friends" : ?Joe }
```

It is possible to use a well chosen document id naming scheme to avoid
this problem, but it is still awkward. TerminusDB uses a number
pre-built ID generation schemes (lexical keys, hash keys and
random). And sometimes it is difficult to even calculate what the
correct ID is, and it is nicer to leave it to TerminusDB to figure it out.

Capture ids make it easy to do provide this sort of forward reference.

```json
{ "@type" : "Person",
  "@capture" : "Joes_ID",
  "name" : "Joe",
  "friends" : { "@ref" : "Jims_ID" } }

{ "@type" : "Person",
  "@capture" : "Jims_ID",
  "name" : "Jim",
  "friends" : { "@ref" : "Joes_ID" } }
```

The naming schema for the capture can be chosen in any way that is
convenient, making it straightforward to load complex interconnected
graphs from JSON quickly.

## Type Inference

Specifying the types of every document can be inconvenient. And for
subdocuments, in which the type is unambiguous it is particularly
irritating.

So we've added a quite general system of type inference which allows
the insertion of documents when there is *precisely one* type for a
document. We might be able to insert a person documents as:

```json
{ "name" : "Joe",
  "friends" : "Person/Jim" }
```

provided no other type can be formed from a `"name"` field of type
string, and a `"friends"` field which points to a person.

## Unconstrained JSON

TerminusDB started with the goal of schema first. The reason for this
decision was experience in dealing with complex but unconstrained
data. Garbage in - Garbage out, so if you don't know you are putting
garbage in, you are in trouble.

However, in practice there are numerous reasons you might want to
store unconstrained data too. Not least because you got the data from
someone who did not constrain it, and perhaps you might even want to
later clean it but only incrementally.

And sometimes, the specification of some JSON interchange standard is
so weak in parts, that it can't really be feasibly modelled.

In this case we need a way to add unconstrained JSON. In the Mule
release, TerminusDB supports unconstrained JSON as a datafield of a
property, or directly as an object.

## Document UI

We have built a toolkit which makes it much more convenient to provide
document curation interfaces. It helps to automatically stucture the
display, editing and submission of documents, including with
geolocation information.

Building knowledge graphs is in practice often a mixture of writing
ingestion which connects data from various sources, automated
enrichment and cleaning procedures, and hand curation. We are trying
to make TerminusDB convenient for all of these workflows.

## The Future: What's next

The next minor release of TerminusDB will have big performance
improvements, especially on document retrieval times.

After that we will begin to work on the scaling features in
anger. Specifically making it possible to load and query larger
federated collections of information conveniently.

And of course, we want to prioritise what our community thinks is
important. So if you have ideas for TerminusDB, we're very open to
suggestions.
