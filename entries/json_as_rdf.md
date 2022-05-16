# JSON as RDF

TerminusDB is a *document graph* database. Meaning that it stores JSON
documents, and the *links* between them allowing you to use TerminusDB
as both a document store and a graph database.

The ability to have *links* between documents requires that there be a
schema which tells us how to interpret the JSON documents that we are
dealing with. If we encounter a string which is in a position which is
expected to be a reference to another document, we try to resolve that
reference, and we will throw an error if that thing does not exist.

However in practice it is sometimes the case that you don't really
want to bother with a schema. You don't know precisely what the
structure is, and you don't need to maintain links. You just have a
lump of JSON that you want to stick in the database. You may still
want to *search* for things in the database for certain fields
however, so you would still like the data to be *indexed* as a graph,
but it is really a *tree* rather than a general graph with links.

Can we find a way to represent such objects as RDF? If we can find a
regular representation then we can create effective procedures for
extraction and insertion of data in this format.

## Representation

Yes, as it turns out, we can.

Let's take the following document which we have borrowed from [json.org](https://json.org/example.html):

```json
{"name":"John", "age":30, "car":null}
```

Let's take each field and stick an arbitrary prefix on it. Let's call
this prefix `json`. Now we can imagine an elaboration of this document
in RDF as the following:

```turtle
json:2b00042f7481c7b056c4b410d28f33cf a json:JSONDocument ;
  json:name "John"^^xsd:string ;
  json:age 30^^xsd:decimal ;
  json:car "null"^^xsd:token .
```

So first, what is this `json:2b00042f7481c7b056c4b410d28f33cf` that we
choose as the name of our document? We need to choose a name that will
not collide with others. One way to do this is to choose a random
token to represent the document. This has the disadvantage that every
time we add the same document we get slightly different RDF.

Another method is to take a hash representation of the document. This
has the advantage that every time put a document in, it will be
exactly in the same place. The *disadvantage* of this approach is that
we can end up with a DAG (Directed Acyclic Graph).

## Directed Acyclicity

In some ways having a DAG is great. It means we get genuine structure
sharing for our graphs and therefore use less space! However there are
some downsides as well. Let's look at an example *diamond* shaped DAG.

```json
 { "docname" : "a",
   "b" : { "docname" : "b",
           "d" : { "docname" : "d" }},
   "c" : { "docname" : "c",
           "d" : { "docname" : "d" }}}
```

We've given these documents a name field so we can better see what the
graph might look like. The downward links in these documents is as
follows:

```
     a
    ↙ ↘
   b   c
    ‌↘ ↙
     d
```

Here we can see that the document `d` is being shared between both `b`
and `c`.

Let's also imagine what the RDF for this might look like:

```turtle
json:190efe62bb06e500e676b4f2c596676d a json:JSONDocument ;
  json:docname "a"^^xsd:string ;
  json:b json:5a47fb2e88b7b0b165f2485b4ff01eb9 ;
  json:c json:ecedab89c0c2b147f631f55d4a8f15c5 .

json:5a47fb2e88b7b0b165f2485b4ff01eb9 a json:JSONDocument ;
  json:docname "b"^^xsd:string ;
  json:d json:972d07526bf7972abeaf77f51da84c8b .

json:ecedab89c0c2b147f631f55d4a8f15c5 a json:JSONDocument ;
  json:docname "c"^^xsd:string ;
  json:d json:972d07526bf7972abeaf77f51da84c8b .

json:972d07526bf7972abeaf77f51da84c8b a json:JSONDocument ;
  json:docname "d"^^xsd:string .
```

But what happens if we *delete* a document. Let's take
`json:190efe62bb06e500e676b4f2c596676d` for instance. When we delete
this document we can't merely delete everything in the downward
closure. We have to check that we're not deleting anything that anyone
*else* refers to. Since we can't see modifications that others might
be doing in the given transaction however, this means we *can't*
delete anything which has other references. In fact we need a *garbage
collection phase* which can transactionally remove everything which
has been made unreachable. But how do we know it is unreachable?

So probably we need an additional tag that tells us that we were
inserted as a *subdocument* and then can assume that the identifiers are
not *really* supposed to be accessible.

## Which to use?

The random approach and the hash approach share a similar document
interface. However the subtle differences matter when we're querying
for instance. If we look for random documents with a given field like
`json:docname "d"^^xsd:string` for instance, in the one case get two
answers, in the other only one.

The ability to avoid having a garbage collection phase though means
that implementation of the random version is simpler, and it's not
clear that the benefits of sharing are sufficiently great.

## Datatypes

The datatypes of JSON need to have a one-to-one correspondence with
RDF and XSD so we know how to marshall back and forth. I suggest the
following:


| JSON   | XSD            |
| :----: | :------------: |
| number | `xsd:decimal`  |
| string | `xsd:string`   |
| bool   | `xsd:boolean`  |
| null   | `xsd:token`    |
| array  | `rdf:List `    |

## Object type

And how should we mark an object as being of the appropriate type
here? If we simply add a type specifier such as `sys:JSON` we could
specify a freely defined JSON as follows:

```json
{"@type":"sys:JSON", "name":"John", "age":30, "car":null}
```

And if we want to add a field in the schema as free JSON, we could do
so as with the following schema:

```json
{ "@type" : "Class",
  "@id" : "Thingy",
  "name" : "xsd:string",
  "metadata" : "sys:JSON" }
```

Now an instance object for the following class might look like:

```json
{ "@type" : "Thingy",
  "name" : "A Thingy",
  "metadata" : { "colour" : "green",
                 "headlight_configuration" : null }}
```

## Opaque JSON

Even simpler than adding a graphified JSON representation would be a
completely opaque and unindexed version which simply stored the above
as a BLOB internally, but which parsed / unparsed the data when
putting it into the database. This would be sufficient for many
use-cases but kills the graph-like and queryable nature. The main
advantage to this would be simplicity.

## Conclusion

I'll be trying to implement a prototype of this, so if anyone has
strong opinions, I'm open to suggestions!
