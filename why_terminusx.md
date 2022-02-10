# [Why TerminusX](https://terminusdb.com/)

I feel some relief and a lot of trepidation that I'm finally seeing
the launch of the TerminusX cloud service. Some very long nights and
too many days have gone into making this possible.

The TerminusX cloud service is built on the substantially over-hauled
and backward incompatible TerminusDB v10. Since we have changed things
so fundamentally, its only fair to explain *why*. Of course the pithy
explanation is: *developer experience*.

But the long explanation is a little more complicated.

## A versioned Knowledge Graph for Collaboration

TerminusDB was designed to be a knowledge graph with the concept of
version control built into the core. This idea developed out of
requirements that we encountered when creating the infrastructure for
the [Seshat Global History Databank](http://seshatdatabank.info/),
which needed to store complex structured data with interconnections
*and* be possible for hundreds of practictioners to clean, edit and
enhance. This seemed like a good job for both a graph and versioning.

And so we set out building a versioned graph.

## Too complex

We built several large and complex knowledge graphs using our
tool. Seshat, a large knowledge graph of corporate intelligence in
Poland and a supply chain management tool with predictive analytics
drawing from the graph. However in every case, the core database team
needed to be intimately involved in the design and deployment. We
couldn't find consultants, or in-house teams that were confident to
forge ahead on an unusual database which had no entries on
StackOverflow.

## Open Source

We decided we needed to be open source if we wanted to get the kind of
broader knowledge required to use our tool effectively. So we released
it to the public, began to grow the community and created a python and
javascript client to encourage application development on the back of
TerminusDB.

We also spent a lot of time writing very elaborate documentation to
describe how to use the product. This was a surprisingly difficult
task as complex tools require a lot of documentation and the people
who are capable of documenting it are often the people who would
otherwise be writing the code.

And we got a fair few users to join our community, ask questions and
plug away at applications. But we heard over and over, the same
problems occuring. The complexity would eventually overwhelm newbies
and they would churn.

## Simplification

We had always viewed TerminusDB as a *document graph*. That is, while
every edge in the system was a genuine edge in the graph (in the RDF
tradition rather than the property-graph tradition), we viewed
*segments* of the graph as belonging to specific objects which could
be treated as related.

One of our early design choices was to use OWL to represent the
*shape* of the graph. This made some sense because OWL is a very rich
language for describing graphs. However it also has some drawbacks. It
is very hard for developers to read OWL - even very smart
developers. It also was never built to describe *schemata* but rather
*ontologies* (to describe what *could* be represented, rather than
what *must* be represented). It also had no concept of a document, so
we had to graft one onto it, again a source of confusion for our users.

## Collaboration

Many people also liked the *concept* of our distributed, git-like,
multimaster setup with TerminusDB (this hasn't gone away...) However
when it came down to it, most people really just don't want to set up
a database anymore. They'd rather use one in the cloud. They don't
want to worry about provisioning or scaling. They'd rather someone
else deal with these problems. And really who is better at dealing
with the scaling problems of a database than the people who made it?

We realised that while a git-like hub might be useful at some point
(after people have built lots of shareable data products) what we
really needed was a cloud database that people could use.

## TerminusX

Eventually we felt we could no longer face our users judgement without
changing things. We decided to simplify the interface, make the
concept of the *document* more central, make the primary interaction
method be through *json* documents and create a schema language that
looks like the JSON you hope to build (and feels more like one you
might write in a programming language).

It's very early days, but *internally* to the team, the traction has
already been noticable. Many more of our staff have built complex
knowldge graphs using our software. We have also trialed the software
with some private beta users, and the feedback has already been
encouraging.

The possibilities that a document graph could bring to application
development has always excited me. I really feel like their day will
come. Its part of why I've been involved with implementation of graph
databases since 2004.

The object store of yore always *felt* like a good idea to me, but I
was aware of its problems: difficulties with referential integrity,
difficulties with concepts of identity etc. These former attempts did
not succeed but they gave us great information as to what *might*
succeed in the future.

We have learned those lessons, and now I hope we have learned the
lessons from our users.

An inter-connected, browsable system of data should be made easy for
developers using the kind of tools they are already comfortable with.

I feel like we are finally approaching that future.

