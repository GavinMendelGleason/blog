# Knwolwedge Graph Schema Design Patterns and Principles

Graphs are extremely expressive, which actually can be a bit of a
problem if we create them without a well defined *schema*. The schema
helps to constraint the sorts of links, acts as documentation,
providing us with both human and machine readable semantics, and
ensures that software gets things shaped the way they are expected.

While good schema design is very important for relational databases,
it's perhaps even more important and central for knowledge graphs.

Unfortunately there isn't a lot of guidance out there on how to do
relatively mundane tasks. I'd like to provide at least a bit of
assistance based on my experience.

We're going to take a look at Schema design patterns and principles
using TerminusCMS, although many of these idea can be used elsewhere.

## Documents

Atoms of data in TerminusDB are represented by fields with a data
type. This could be a string, or an integer, or a date. These are in
turn, woven into a molecule of data, known as a *document*.

Let's look at a `Person` document so we get a clearer picture.

```json
{ "@type" : "Class",
  "@id" : "Person",
  "first_name" : "xsd:string",
  "family_name" : "xsd:string",
  "date_of_birth" : "xsd:dateTime"
}
```

This person carries a name and a date of birth. In fact, it is, as
written, very close to a *row* record in an RDBMS or a CSV file.

To make things interesting however, we can add some additional
*links*.

```json
{ "@type" : "Class",
  "@id" : "Person",
  "first_name" : "xsd:string",
  "family_name" : "xsd:string",
  "date_of_birth" : "xsd:dateTime",
  "friends" : { "@type" : "Set", "@class" : "Person" }
}
```

Now we can list also add links to friends of the person in
question. This is the sort of data structure you might use for a
social network, or even perhaps a rolodex type application.

This is the simplest sort of modelling that we can do - where you have
a number of data properties, and a number of links to other documents,
all bundled conveniently in your document.

## Subdocuments

However, sometimes you want to have internal structure in your
document, that is not just an atom of data, *but* which is
intrinsically related to this specific object, and not simply a link
to another object.

The most common variety of this type of object, is data which is
somehow annotated with additional structure. For instance, we might
want to have a data point which is time scoped, has a specific source,
or perhaps has a unit.

```json
{ "@type" : "Enum",
  "@id" : "Unit",
  "@value" : [ "meters", "kilograms" ] }

{ "@type" : "Class",
  "@id" : "UnitValue",
  "@subdocument" : [],
  "value" : "xsd:decimal",
  "unit" : "Unit" }
```

It doesn't make sense for this value to just float around by itself,
but it might be useful in the context of a specific object, for
instance, the height of a person.

The `"@subdocument" : []` specifies that this class is a subdocument
class. It will be entirely owned by the containing class, nobody else
will be allowed to point to it, and it will always come back as a
fully expanded json document when we search for the containing document.


```json
{ "@type" : "Class",
  "@id" : "Person",
  "first_name" : "xsd:string",
  "family_name" : "xsd:string",
  "date_of_birth" : "xsd:dateTime",
  "friends" : { "@type" : "Set", "@class" : "Person" }
  "height" : "UnitValue",
  "weight" : "UnitValue",
}
```

You might notice that `height` and `weight` are both `UnitValue`, but
are not necessarily of the right unit! We are currently in the process
of adding *restrictions* which will allow such constraints also to be
described, but that's for another blog post! :D


## Relationships

Not all relationships can be reduced to a simple link. However, it is
often possible to represent them with a subdocument, adding the
auxilliary information in a way similar to the way we adorned the
base-type `xsd:decimal` with a unit.

However, if you have a complex relationship, it often makes sense to
lift it up as a first class object itself.

For instance, supposing we want to represent a share holding
relationship. We can do this as follows:

```json
{ "@type" : "Class",
  "@id" : "Company",
  "name" : "xsd:string" }
{ "@type" : "Class",
  "@id" : "Shareholder",
  "name" : "xsd:string" }
{ "@type" : "Class",
  "@id" : "Company",
  "@inherits" : "Shareholder" }
{ "@type" : "Class",
  "@id" : "Person",
  "@inherits" : "Shareholder" }
{ "@type" : "Class",
  "@id" : "Shareholding",
  "quantity" : "xsd:decimal",
  "shares_in" : "Company",
  "held_by" : "Shareholder",
  "from" : "xsd:date",
  "to" : { "@type" : "Optional", "@class" : "xsd:date" }}
```

Our `Shareholding` relationship has two different links, one of which
is the company in which shares are held, and the other is the
shareholder, which could be either a person or a company. But now we
have also adorned the object with a quantity, and a period over which
they were held.

This sort of first class relationship link can be expanded to deal
also with *hypergraphs* where there are more than two objects in the
relationship (a recievership is such a relationship).

## Mixins: Multiple Inheritance for Aspect

Multiple inheritance is a very powerful tool in programming languages,
but in data, it arguably works even better. And *mixins* (some traits
which are mixed-in) are one of the ways that you can get re-use out of
your data modelling.

A few examples of cross-cutting aspects of data modelling have come up
repeatedly in my modelling experience. These include: space, time,
provenance and units.

### Temporal Scope

The `Shareholding` example above used a temporal component, but this
could also be pulled out as a *mixin* which can be used elsewhere.

```json
{ "@type" : "Class",
  "@id" : "TemporalScope"
  "from" : "xsd:date",
  "to" : { "@type" : "Optional", "@class" : "xsd:date" }
}
```

The `from` date is given as required for something temporally scopped,
but the `to` date is left as optional, in order to model scoping which
has *not* yet ceased.  Of course you might not always want this, but
it's often a very useful approach.

We might also have an *event* which simply happens at a time:

```json
{ "@type" : "Class",
  "@id" : "Event"
  "at" : "xsd:date"
}
```

### Spatial Scope

We can also refer to a geometry to add spatial scope to our objects by
way of inheritance. The mixin for spatial scope might look like this:

```json
{ "@type" : "Class",
  "@id" : "GeographicScope",
  "geometry" : "Geometry" }
```

Where `Geometry` refers to the `Geometry` class from
[GeoJson](https://github.com/terminusdb-labs/GeoJSON/).


### Provenance

It's very common to have a resource which has a *source* which needs
to be recorded, so as to understand how we have come to know
something. This is typical when we obtain a resource from, for
instance, a website.

In this case we might have an object that inherits `Event` and
`Source`

```json
{ "@type" : "Class",
  "@id" : "Source",
  "source" : "xsd:anyURI"
}
{ "@type" : "Class",
  "@id" : "WebScrape",
  "@inherits" : ["Event", "Source"],
  "page" : "xsd:string",
}
```

## Collections

Collections in a graph can be modelled in many different
ways. TerminusDB implements three different methods to try and simplfy
things for modelling, yet it's important to understand the
distinctions between these three methods: `Set`, `List`, and `Array`.

### Set

The `Set` is the simpliest of the three, as it has no order, and is
really just an edge with greater multiplicity than one. In the graph
a set for an edge with three elements looks as follows:


```
    ∘
  ↗
∘ → ∘
  ↘
    ∘
```

### Array

The `Array` is a more complicated object, which encodes an index,
giving order, and which enables a few addition features which
differentiate it from `Set`s and `List`s.

```
       v0
 value↗
    ∘ idx→ 0
   ╱
  ╱  	v1
 ╱	  ↗
∘ → ∘ idx→ 1
  ↘
    ∘ → v2
   idx↘
        2
```

Each value element of the array, has an additional (hidden)
indirection object with an index (or multiple indexes for
multidimensional arrays).

This allows us to have not only order, but multiple dimensions and we
can represent *gaps*.  When returning the values in JSON, we will get
back a multidimensional array with `null` fields for regions that are
not filled. However they are not actually represented at all in the
database.

### List

The List is actually lifted directly from `rdf:List` and uses the same
fields as are described in `rdf`, namely `rdf:first` and `rdf:rest`.

The list structure for a three element list looks as follows:

```
∘ → ∘ rest→ ∘ rest→ ∘ rest→ rdf:nil
    ↓ first ↓ first ↓ first
    v0      v1      v2
```

The linked-list style structure has potential technical advantages in
that you can insert anywhere in the list without having to reindex
everything after the given element. However, you also have to traverse
long chains in the graph to decode a list.

## Conclusion

I'm always on the look out for patterns and approaches that can make
modelling a more pleasant experience, and even more importantly, to
make it easy to manipulate and discover data once it is modelled. If
you have other interesting ideas, join our Discord and give us a
shout!
