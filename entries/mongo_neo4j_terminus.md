# What if MongoDB and Neo4j had a baby

The NoSQL revolution has reshaped the world. Surely, some of these
changes are for worse, but most developers couldn't care less about what
the relational enthusiasts think.

The emergence of MongoDB brought the 0-to-60 for data storage in
applications down by an order of magnitude. It's like a rocket sled
for application development (and probably just as safe). But developer
experience and ease of use are paramount, especially in a world
over-burdened with complexity.

Neo4j is no slouch either. Before Neo4j, graph databases were
virtually unknown. While it hasn't had the same impact of total
reconfiguration of the data management landscape for applications, it
has found a healhty niche, largely in problem domains that one might
describe as *embarrassingly connected*. And of course, once you start
thinking in a graphy way, most problems end up looking *embarrassingly
connected*.

## Data is JSON and the Graph is everywhere

JSON is *the* medium of data communication. This is why MongoDB has
had such a profound effect on application development.  You can store
your data in essentially the way you mean to manipulated it in your
programming language.  This radically reduces the impedence mismatch
which has been a constant source of irritation for developers who were
forced to use SQL. It's also re-usable as an abstract syntax tree for
building the communication of queries and updates themselves. No
longer do you have to build a query with brittle concatenations of
strings.

But trees are not really the only data structure we need even if they
are the only thing that JSON can easily represent. Our programming
languages have references or pointers because we need them to
represent many of the data structures that we encounter. Although not
everything is a graph, many things are. This is the insight which
graph databases bring. Relationships *between* data are almost as
important as the data itself.

But why not both? Can't we have a database that allows us to fully
overcome the object-relational impedence mismatch of old? Which fuses
the benefits of the document store with the benefits of the graph?

Luckily we can have our cake and eat it too. What we need is a
love-child of Mongo and Neo4j.

## The Document Graph

All that is required to join these two worlds is the concept of a
reference and a way to ensure that we have referential integrity
(i.e. no dangling pointers). With this in hand we can design our
storage data structures such that we can follow these links
efficiently.

In TerminusDB, we do this using URLs. This borrows from the original
concept of the HTML page, which is iself a structured document with
hyper-links, but one designed for rendering rather than data
manipulation.

Instead of HTML with URLs, we use JSON with URLs, but the concept is
very similar. As an example, a document which describes a person might
look something like:

```javascript
{ "@id" : "Person/Jim+Smith",
  "@type" : "Person",
  "forename" : "Jim",
  "surname" : "Smith",
  "friends" : ["Person/Jill+Stone","Person/Peter+Miller"] }
```

We write down the references relative to the base URL prefix which we
assume for our collection, which might be something like
`http://terminusdb.com/db/Terminators/Humans/`. The fully qualified
URL would be rendered as something like:
`http://terminusdb.com/db/Terminators/Humans/Person/Jim+Smith`. This
makes it easier to read and write. But how do we know this is a
reference and not a string? This is an important distinction for
several reasons. It tells us how to index our objects such that
traversals are fast, making it a real relationship rather than
something that has to be calculated. It also keeps us from accidental
misinterpretation - disambiguating a URL from a database relationship
for instance. But it also allows us to ensure referential integrity,
at least for links which are internal to our database. This is really
important when dealing with large linked data stores, otherwise we
could easily end up with lots of broken links. It's very similar to a
foreign key-constraint in a relational database.

These logical constraints are described with a schema. The one for a
person might be something like:

```javascript
{ "@type" : "Class",
  "@id" : "Person",
  "@key" : { "@type" : "Lexical", "@fields" : [ "forename", "surname" ] },
  "forename" : "xsd:string",
  "surname" : "xsd:string",
  "friends" : { "@type" : "Set", "@class" : "Person" }
  }
```

The use of JSON for a document database with hyperlinks gives us the
best of both worlds. The price we pay is that we have to be
schema-first, something that is somewhat alien to both the MongoDB and
GraphDB communities, but was common in the RDBMS era.

This cost is real but it *is* an advantage in the long-term for
keeping data integrity and avoiding the kind of speghetti that can
result from unconstrained graphs and documents. So you have to pay a
bit in up-front capital costs, but the operational costs will be lower.

Since the cost is real, we are always on the lookout for ways of
reducing this upfront cost, including methods of inference with
anomolie detection etc. This has the potential to get the best of all
worlds, allowing us to do rapid prototyping and then subsequent
lockdown of the schema.

## From RDF to Linked Documents.

TerminusDB started its life as an RDF database and that's still what
it is under-the hood. RDF was the semantic web's answer to the
question of how to represent data, leveraging the ideas which had been
learned in designing the web, and leveraging this for data. The
semantic web had already started delving into Web3 topics long before
Web3 existed as a concept.

Unfortunately it never really took off. There are many reasons for
this, some of which are explored in [Graph Fundamentals Part 4: Linked
Data](https://terminusdb.com/blog/graph-fundamentals-part-4-linked-data/).

Part of the reason for this is that RDF is somewhat hard to read, but
even harder to write. Data is *completely* represented in the
relationships and not in documents (as it is with HTML). This provides
no fundamental barrier to representation, but it can be a bit like a
puzzle box to figure out how to weave everything into the graph, or
what someone meant by their own particular weave once
constructed.[*](#wordnet).

This problem is alleviated by the concept of the *Document* which
bundles links together into a single atomic collection of
information. The schema gives us a map to move back and forth between
the JSON representation of the document, and the links in a graph.

The`Person` document for `Person/Jim+Smith` maps to something like:

```turtle
@prefix data: <http://terminusdb.com/db/Terminators/Humans/> .
@prefix schema: <http://terminusdb.com/db/Terminators/Humans#> .

data:Person/Jim+Smith
  a schema:Person ;
  schema:forename : "Jim"^^xsd:string ;
  schema:surname : "Smith"^^xsd:string ;
  schema:friends : ( data:Person/Jill+Stone , data:Person/Peter+Miller )
```

And of course, this can be converted in the opposite direction. The
JSON version has the advantage of familiarity and is immediately
manipulable in our favourite language.

## Subdocuments

In addition if we want to have a larger fragment of the graph
expressed as a JSON document, we can simply use the concept of a
*sub-document*. This is where we get signficant advantages over the
direct RDF representation, where what we intend to be a packaged
object is left as an exercise to the programmer.

Let's extend the definition of a person above with an address.


```javascript
{ "type" : "Enum",
  "@id" : "Country",
  "@value" : [ "Ireland", "South Africa", "UK", "Netherlands",
               "Austria", "India"] },

{ "@type" : "Class",
  "@id" : "Address",
  "@subdocument" : [],
  "@key" : { "@type" : "Random"},
  "line1" : "xsd:string",
  "line2" : { "@type" : "Optional", "@class" : "xsd:string" },
  "postal_code" : "xsd:string",
  "city" : "xsd:string",
  "province" { "@type" : "Optional", "@class" : "xsd:string" },
  "country" : "Country" },

{ "@type" : "Class",
  "@id" : "Person",
  "@key" : { "@type" : "Lexical", "@fields" : [ "forename", "surname" ] },
  "forename" : "xsd:string",
  "surname" : "xsd:string",
  "address" : "Address",
  "friends" : { "@type" : "Set", "@class" : "Person" } }
```

Now we can include an address as part of our JSON document, and it is
thought of as a single included component, even though we defined it
separately in a composable way in the schema.

Now our record for Jim might be something like:

```javascript
{ "@id" : "Person/Jim+Smith",
  "@type" : "Person",
  "forename" : "Jim",
  "surname" : "Smith",
  "friends" : ["Person/Jill+Stone","Person/Peter+Miller"],
  "address" : { "line1" : "Ferdinand Bordewijkstraat 1",
                "city" : "Wageningen",
                "province" : "Gelderland",
                "postal_code" : "6708 RB",
                "country" : "Netherlands" } }
```

And further, when converting this to RDF we get a universally assigned
and fixed ID - unlike the [blank
nodes](https://en.wikipedia.org/wiki/Blank_node) of RDF. This is
essentially a form of automatic
[Skolemisation](https://en.wikipedia.org/wiki/Skolem_normal_form)
which is user directed by describing how one would like the `@key` to
be constructed. We have chosen to generate the key from the name for
the `Person`, but have assigned a random `@key` for the address. We
could have instead used a `ValueHash` which would produce a unique
address based on the *content* (which makes this a form of content
addressable hasing).

## Elaboration and JSON-LD

The approach of a document oriented approach to RDF was already
present in [JSON-LD](https://en.wikipedia.org/wiki/JSON-LD), the
RDF/Linked Data answer to JSON represntation.

This specification was well thought out and well designed. However in
our experience in working with the representation we found it was *too
low level* to be convenient to write and use directly. It is instead
used in TerminusDB largely as an intermediate representation, with the
fully elaborated version converted into RDF to store in the Database.

The process of
[elaboration](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.139.346&rep=rep1&type=pdf)
(a concept borrowed from type theory) uses the schema to equip a
fairly sparse JSON document with all of the information necessary to
convert it directly to RDF triples.  A fully elaborated version of the
`Person` object might look like:

```javascript
{ "@id":"data:Person/Jim+Smith",
  "@type":"schema:Person",
  "schema:forename": { "@value":"Jim",
                       "@type":"xsd:string" },
  "schema:surname": { "@value":"Smith",
                      "@type":"xsd:string" },
  "schema:friends": {"@container":"@set",
                     "@type":"schema:Person",
                     "@value" : [ "data:Person/Jill+Stone",
                                  "data:Person/Peter+Miller" ] }
  }
```

This elaboration could be useful as a means of communicating the
document with much of its schematic information included. But for most
application development purposes, it simply is not needed.

I'll be writing more about the elaboration process in a subsequent
post.

## Thesis - Antithesis - Synthesis

The use of subdocuments, the automatic generation of IDs, and the
complete elimination of blank nodes is a major improvement over what
exists already in the semantic web world.

The addition of native JSON document store capabilities as well as
being a native graph database with fast link traversal means we have a
synthesis which leverages the advantages of both worlds. Documents and
graphs can live together naturally and compliment eachother.

There is work to be done to reduce the barrier to entry still futher,
and eliminate some of the frictions of schema-first. However, we can
already see the advantages of what we have already in TerminusDB.

<a name="wordnet">*</a> To see a great example of this try sorting out
how to navigate the Lemmata in WordNet.
