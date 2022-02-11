# What if MongoDB and Neo4j had a baby

The NoSQL revolution has reshaped the world. Surely some of these
changes are for worse, but most developers could care less about what
the relational enthusiasts think.

The emergence of MongoDB brought the 0-to-60 for data storage in
applications down by an order of magnitude. It's like a rocket sled
for application development (and probably just as safe). But developer
experience and easy of use are paramount, especially in a world over
burdned with complexity.

Neo4j is no slouch either. Before Neo4j, graph databases were
virtually unknown. While it hasn't had the same impact of total
reconfiguration of the data management landscape for applications, it
has found a healhty niche, largely in problem domains that one might
describe as *embarrassingly connected*. And of course, once you start
thinking in a graphy way most problems end up looking *embarassingly
connected*.

## Data is JSON, The Graph is everywhere

JSON is *the* medium of data communication. This is why MongoDB has
had such a profound effect.  You can store your data in essentially
the way you mean to manipulated it in your programming language.  This
really reduces the impedence mismatch which has been a constant source
of irritation for developers who were forced to use SQL. It's also
re-usable as an abstract syntax tree for building the communication of
queries and updates themselves. No longer do you have to build a query
with brittle concatenations of strings.

But trees, are not really the only data structure we need even if they
are the only thing that JSON can easily represent. Our programming
languages have references or pointers because we need them to
represent many of the datastructures that we encounter. Although not
everything is a graph, many things are. This is the insight which
graph databases bring.

But why not both? Can't we have a database that allows us to fully
overcome the object-relational impedence mismatch of old? Which fuses
the benefits of the document store with the benefits of the graph?

Luckily we can have our cake and eat it to. What we need is a
love-child of Mongo and Neo4j.

## From RDF to Linked Documents.

TerminusDB started its life as an RDF database. RDF was the semantic
web's answer to the question of 
