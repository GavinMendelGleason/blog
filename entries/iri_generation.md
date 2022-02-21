# What's in a Name: URI Generation and Unique names for objects
## Fixing Linked-Data pain-points by briging RDF and RDBMS id generation

In TerminusDB we have both automatic and manual means of describing
the reference of a document in our graph. We have tried to make these
as simple as possible to work with based on our experience of the
difficulties encountered trying to create URIs in RDF in practice.

We're going to look at various identifier generation strategies,
including: manual, lexical, hash, random, and value hash.

But to see why we introduced these choices and strategies, it's useful
to think a bit about ID references from first principles.

## The Semantic Web

One of the really interesting ideas to come out of the Semantic Web
was the idea of using unique universal identifiers on a similar model
to the URL. The Web forms a vasty interconnected graph, with edges
specified by these URLs.

A *URI* is subtly different. A URI is a *Universal Resource Indicator*
as opposed to a *Universal Resource Locator*. The distinction revolves
around whether they should *resolve* to the resource that they
indicate.

A *URI* *could* be a *URL* but it need not be. A *URI* could stand in
for any sort of resource, physical or logical which we need to have a
name for. It is, in a sense simply a name which we want to be
*universal*.

A good example of a URL that is also a URI, are the HTTPS syntax for
DOI (Digital Object Identifiers) which specify a specific scientific
paper. For instance, we can talk about the Quantum Tomography paper
[Measured measurement](https://doi.org/10.1038/nphys1170) with the DOI
`https://doi.org/10.1038/nphys1170`, but if you go to that address it
will forward you to the actual resource.

Another example where we might double up the meaning might be if we
used the URL `https://en.wikipedia.org/wiki/Albert_Einstein` to refer
to the person Albert Einstein in our database, but which will resolve
automatically to an article on wikipedia.

## A thing and its Name

However these URIs (or IRIs, for Internationalised Resource Indicator,
if we are being international) do not have to know how to resolve to
the objects they describe, even if it can be handy for them to do
so. If data is to move around, records will have to be in different
states in different places, so resolving an object to exactly what
data is associated with it, is not possible to do in all cases.

Despite this, it might be nice to dereference a *canonical* version of
the data, for some notion of canonical. And so some thought should go
in to how one might usefully make our URIs into URLs as well.

Another aspect of the subtly is the difference between the name of the
thing and the thing itself. Of course the Albert Einstein URL above is
not actually yielding us Albert Einstein when we dereference it. It's
giving us some meta-data about Albert Einstein, since the resource
itself is unavailable.

## Universality

The universality of naming is a major benefit. It means that you have
a distributed means of describing the objects you are interested
in. URIs can exist in multiple different database systems, or be
passed around, live, in applications.

This is a big step forward over the use of situationaly dependent ids
such as integers counting from zero, which is a very bad way of
representing things if you want to reference the system externally, or
if you want to have a distributed or decentralised system.

## How to Name Something?

Naming is hard. Any programmer who has had to come up with a name for
a variable or function such that his colleagues, (or they themselves
later) can understand what it does knows this viscerally. When
multiple people or systems are trying to come up with names which
agree with eachother, it's even worse.

Unfortunately, there is no easy way to avoid this completely. Some
coordination and governance is required to obtain shared names
appropriately. For URLs this is addressed with organizations such as
ICANN, but others who want to mange naming will have to produce their
own approaches.

## URI Shorthand

In terminusDB, we reference documents with a URI. This URI uses an
implicit or explicit *prefix* which is not necessary to refer to when
the context is unambiguous. You can think of this a bit like the way
we use modules for identifiers in programming languages.

When I create a new data product (a new document graph) I specify a
set of prefixes, including the default `@schema` and default `@base`
prefixes. The schema prefixes are for the *type* or *schema* level,
and the *instance* or *document* level.

These are specified in a context object. A typical context object will
look something like:

```json
{ "@type" : "Context",
  "@schema" : "https://lib.terminusdb.com/people#",
  "@base" : "https://lib.terminusdb.com/people/" }
```

When we refer to a specific element of the data collection, we would
write down its short name as something like `Person/joe`. It's
expanded name would be something like:
`https://lib.terminusdb.com/people/Person/joe`.

Using this sort of naming, all TerminusDB objects can be refered to
with an unambiguous URI, and we can also dump a TerminusDB database as
valid RDF.

## Keys

Coming up with the right URI for an object is hard. Especially when
you are generating lots of them programattically. Fortunately, we
*can* make things easier. We can use a *key*. Keys are used in
relational databases to establish the identity of a row, but they are
generally treated as a constraint on the table. In fact we can use the
key as a unique name which can always be used to describe an object.

Supposing we already have a unique identifier, such as a social
security number. In this case we can be assured that a record for an
individual person can have a uniquely designated object in our system.

The schema document for a `Person` class might look like this:

```json
{ "@type" : "Class",
  "@id" : "Person",
  "@key" : { "@type" : "Lexical", "@fields" : ["ssn"]},
  "ssn" : "xsd:string",
  "name" : "xsd:string"
}
```

Using this key specification, an individual for the class would like
something like:

```json
{ "@type" : "Person",
  "@id" : "Person/078-05-1120",
  "ssn" : "078-05-1120",
  "name" : "Hilda Schrader Whitcher" }
```

In fact, since we are using a key, we can simply leave out the `"@id"`
field when we are submitting and the field can be calculated
automatically. We could instead submit the following document:

```json
{ "@type" : "Person",
  "ssn" : "078-05-1120",
  "name" : "Hilda Schrader Whitcher" }
```

This is handy, since we can ignore the process of ID generation
entirely. We can submit updates without knowing what the current name
of a document is, or understanding precisely its strategy for
generation.

This particular case demonstrates a (famous!) leak of a social
security number. We reference a private, but unique identifier which
should not be displayed to everyone who might want to be able to
*reference* such a document. In order to avoid the disclosure of
information in the name, or if the name does not display very useful information we can use a *hash*.

```json
{ "@type" : "Class",
  "@id" : "Person",
  "@key" : { "@type" : "Hash", "@fields" : ["ssn"]},
  "ssn" : "xsd:string",
  "name" : "xsd:string"
}
```

With this alternative naming strategy we have the id generated using sha256 as:

`Person/ef6385e04468128770c86bf7e098c70fa7bbc1a50d81a071087f925283a4e7af`

Now we have the same ability to generate the name uniquely, but this
time without leaking information the IRI.

For those from an RDF background, it might be interesting to see that
this consists of two graphs, one for the schema and one for instance,
with the following turtle:

Schema:
```turtle
@base <terminusdb:///schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sys: <http://terminusdb.com/schema/sys#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix doc: <data/> .

doc:Cons\/2387e9641235cbfcc495f3deadb79d209a97b48d0233dbf015399eb74f8629fc
  a rdf:List ;
  rdf:first <schema#ssn> ;
  rdf:rest rdf:nil .

<schema#Person>
  a sys:Class ;
  sys:key <schema#Person/key/Hash/ssn> ;
  <schema#name> xsd:string ;
  <schema#ssn> xsd:string .

<schema#Person/key/Hash/ssn>
  a sys:Hash ;
  sys:fields doc:Cons\/2387e9641235cbfcc495f3deadb79d209a97b48d0233dbf015399eb74f8629fc .
```

Instance:
```turtle
@base <terminusdb:///data/> .
@prefix scm: <../schema#> .
<Person/ef6385e04468128770c86bf7e098c70fa7bbc1a50d81a071087f925283a4e7af>
  a scm:Person ;
  scm:name "Hilda Schrader Whitcher" ;
  scm:ssn "078-05-1120" .
```

# When is a Thing not Another Thing

Keeping the key in the name is a kind of content addressability. And
in the case of the use of a hash, it is a variety of content
addressable hashing.

Notably, it does *not* disambguate the entire document. Usually we
understand the *identity* of a thing to outlive its precise data. With
a fully content addressable hashing, a things identity is *precisely*
the information we have about it.

Often you might want to change someones address, or even just add a
new address record with a new time span on it. It's likely that you
don't want either of these operations to change the *reference* to
this document.

On the other hand, you might want the *address* for the person to
remain completely defined by its data. An address could have a fair
bit of information in it, including the street, province, etc. So
defining this as a lexical could be done as something like:

```json
{ "@type" : "Enum",
  "@id" : "Country",
  "@value" : ["US", "Ireland", "Austria"] },

{ "@type" : "Class",
  "@id" : "Address",
  "@key" : { "@type" : "Lexical",
             "@fields" : ["street", "province", "country"] }
  "street" : "xsd:string",
  "province" : "xsd:string",
  "country" : "Country" }
```

This will work, but perhaps it's easier to write:

```json
{ "@type" : "Class",
  "@id" : "Address",
  "@key" : "ValueHash",
  "street" : "xsd:string",
  "province" : "xsd:string",
  "country" : "Country" }
```

The later designation will assign a hash address using *all* available
data. New attempts to add the old address will simply reuse the exact
same record!

## Rolling the Dice

When generating *events*, we need new identifiers every single
time. To do that we need to choose *fresh* identifiers which will not
overlap with identifiers coming from others. In TerminusDB we do this
with the `Random` key generation strategy. These can be *refered* to
for update using their name in the same way as others, but when being
created, they generate a large probabilistically unique hash. The hash
is *very* large, so collision probabilities are astronomically low and
can be safely ignored.

Our event schema might look as follows:

```json
{ "@type" : "Enum",
  "@values" : ["Volcanic Eruption", "Hell Fire", "Plague"] }

{ "@type" : "Class",
  "@id" : "Event",
  "event_type" : "EventType",
  "actor" : "xsd:string" }
```

When we insert some events (using the document interface), they might
look as follows:

```json
[{ "@type" : "Event",
   "event_type" : "Hell Fire",
   "actor" : "God" },
 { "@type" : "Event",
   "event_type" : "Volcanic Eruption",
   "actor" : "Volcano" },
 { "@type" : "Event",
   "event_type" : "Plague",
   "actor" : "Locusts" }]
```

The API will return a list of document IDs:

```json
["Event/480d554f9357b974694a4ffc42f39b9ac38761bc28257cff14168ba18912c398",
 "Event/456691cbb7564edad50ffd4f4245f760b1d4eb4459a31761324180ef1fa75d50",
 "Event/ba629b086337d94c7ca89c02d04e6fa2e9cb28bbf03b7e93f30e74a9b5a7962c"]
```

These are just generated from whole cloth and have nothing to do with
their data. Therefore, we will need to refer to them explicitly by ID
from now on. This often makes the most sense when we will refer to
them from other (perhaps more explicitly named) objects.

## Explict Naming

> “When I use a word,” Humpty Dumpty said in rather a scornful tone,
> “it means just what I choose it to mean—neither more nor less.”

Sometimes we just need to use the name of a thing the way it
exists. This could happen referring to documents with names that are
generated externally, or it could be that we just want our URIs to be
self-explanatory and not based on something which can be generated
from a key.

In this case we just always pass the `@id` around whenever we refer to
the object, whether inserting, updating or deleting.

## Easier is Better

We had a lot of pain trying to generate large RDF graphs when we were
getting started. The problem of naming, not having a good way to
recognise already entered objects, no good way of "consing" up a name
for something, whether tied to data, or random all caused stumbling
blocks. A *lot* of special purpose logic went into scripts, where it
was made to be correct after a lot of tweaking, and then remained
completely opaque to everyone who did not read the ingestion script.

Embedding id generation into our system has helped to alleviate a lot
of those problems, and has made our system more declarative, and more
transparent. Hopefully with a bit of playing around, you can
appreciate the advantages.
