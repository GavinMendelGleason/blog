# Gradual Typing for Graph Data

Gradual typing in the term we use to describe a variety of refinement
typing which can be applied to data. By gradual typing we mean to
imply that you can slowly move from an untyped (that is universally
typed) situation to one with quite explicit typing.  Untyped is really
the same as universally typed. Every piece of data is made to fit a
generic type. This universal type we call `top`.

In this model we have a "real" type hierarchy formed of discrete types
based on *data layout*, and *refinements* over these concrete
types. Ultimately everything lies in a single multiple-inheritance
type hierarchy and the types form a *complete lattice*.

By a complete lattice we mean that every two types has a well defined
*join* and *meet*. We will make this more concrete after we describe
the basis of our type hiearchy with some primitive types.

```
                        top
                      /     \
               document      value
               /  |  \
            JSON BSON TerminusDoc
```

The value hierarch itself is quite elaborate, and includes all of XSD,
as well as BSON types but we have not drawn the entire thing
here. Some elements in this data hierarchy are really themselves
*refinements* in that they do not change data layout, and indeed which
actually change data-layout is somewhat arbitrary since it could in
principle be given a different layout.

An example of such a refinement of a layout is `Token` which is
actually simply a `string` in terms of its representation.

An example of a value type could be the following (the xsd prefix, as
used here for string, will be implicit when there is no ambiguity):

```prolog
x : string
```

This can be thought of as a degenerate refinement type with the
predicate: `true`

```prolog
{ X : string | true }
```

We can *refine* this type to a more specific type that has greater
constraints. For instance we could write

```prolog
{ X : string | X ~= "[1-9][0-9]*" }
```

This would define a valid positive integer represented in decimal as a
string.

## Meet and Join

One can define a lattice with a less than or equal (`≤`) operator, but
for us it is more natural to think of meets (`∧`) and joins (`∨`).

In the type lattice, a meet between `A` and `B` induces a new type
which is *both* of `A` and `B`.

```
   A   B
    \ /
    A∧B
```

`A∧B` must have every property which can be attributed to A and every
property which can be attributed to B.

To make this *complete* we also need a *bottom* (`⊥`) value, which is
the result of an impossible join. i.e. `integer ∧ string` which can't
have any possible inhabitant at all (because you can't be an integer
and a string at the same time).

Similarly, we can define a join operation, which will induce a type in
the latice which is *either* of any two types. And of course,
sometimes this join will simply be `top`.

```
   A∨B
   / \
  A   B
```

Many of these meets will need to be represented by simply the
described meet itself, for instance, the result of `integer ∨ string`
has no more compact representation.

### Meet and Join of refinements

If we have a meet of two refinement types with the same underlying
type, the meet is the conjunction of the refinements.

```prolog
{ X : string | X =~ "foo.*" } ∧ { X : string | X =~ "bar.*" }
      ≡ { X : string | X =~ "foo.*" & X =~ "bar.*" }
```

In this case we have a type which can not be inhabited, but to
determine this we need to be able to perform conjunctions (or
disjunctions) of regex and simplify them. While this is possible in
principle with regex, we will not assume that our refinement type
system can always detect uninhabitable types.

For the meet of two concrete value types which are not the same, we
must always obtain bottom. The reason being that our concrete
representations and layout are simply not guaranteed to be identical.

However, we *can* meet JSON and BSON for instance as these have a
common dictionary representation which is a subset of JSON and which
has unordered fields.

### Refinements of Documents

Documents are the core storable element, and the most important record
for communication of data in TerminusDB. For this reason we need a
rich calculus for describing the properties of documents.

This refinment calculus is a *kernel* calculus which is meant to be a
target language suitable for a variety of different constraint
oriented calculi (such as JSON-Schema).

TerminusDB provides short hand *class* descriptions which provide
suscinct methods of describing what can be stated with the
refinements.

Document refinements start with the ability to quantify over properties.

For instance, the following document type, describes all documents
which are valid JSON documents as a mutually recursive definition.

```prolog
type jsonvalue = bool ∨ number
type jsonlist = list(json ∨ jsonvalue ∨ jsonlist)
type json = { X : document | ∀ K ∈ keys(K) ⇒ X.K : string ‌∨
                                                    bool ∨
                                                    null ∨
                                                    number ∨
                                                    json ∨
                                                    jsonlist }
```

### Refined Documents

These json types could, however, be much more constrained. For
instance, we might have a `user` document, which could be represented
as follows:

```prolog
type user = { X : json | ∀ K ∈ keys(X) ⇒
                         if K == "first_name" then X.K : string
                         else if K == "family_name" then X.K : string
                         else if K == "date_of_birth" then X.K : dateTime
                         else if K == "email"
                              then X.K : string ∧
                                   X.K ~= "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}" }
```

Note: An empty `else` clause is simply false if no clause matches. The
use of `if_then_else` simplifies exclusion of cases such as as might
occur when matching arbitrary unspecified properties. For instance,
if we wish to make the user record much less strict, with an *open*
definition for other properties, we might write:

```prolog
type user = { X : json | ∀ K ∈ keys(X) ⇒
                         if K == "first_name" then X.K : string
                         else if K == "family_name" then X.K : string
                         else if K == "date_of_birth" then X.K : dateTime
                         else if K == "email"
                              then X.K : string ∧
                                   X.K ~= "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}"
                         else X.K : value }
```

### Required Fields

But we can also make things *more* strict, adding requirements that
fields exist, for instance:

```prolog
type user = { X : json | ∃ K ∈ keys(X) ⇒ K == "first_name" ∧
                         ∃ K ∈ keys(X) ⇒ K == "family_name" ∧
                         ∀ K ∈ keys(X) ⇒
                         if K == "first_name" then X.K : string
                         else if K == "family_name" then X.K : string
                         else if K == "date_of_birth" then X.K : dateTime
                         else if K == "email"
                              then X.K : string ∧
                                   X.K ~= "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}"
                         else X.K : value }
```

This ensures that the `first_name` field and `family_name` field, both
exist and are well typed.

### Field Patterns

We may want a particular family of fields to be given a type. One
could imagine a scenario in which there is a naming scheme for a
number of fields which are relatively unstructured, as might be the
case when we have fields from some external system which we want to
track, for instance:

```prolog
type user = { X : json | ∃ K ∈ keys(X) ⇒ K == "first_name" ∧
                         ∃ K ∈ keys(X) ⇒ K == "family_name" ∧
                         ∀ K ∈ keys(X) ⇒
                         if K == "first_name" then X.K : string
                         else if K == "family_name" then X.K : string
                         else if K == "date_of_birth" then X.K : dateTime
                         else if K == "email"
                              then X.K : string ∧
                                   X.K ~= "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}"
                         else if K ~="external_.*"
                              then X.K : document
                         else X.K : value }
```

This ensures that the `first_name` field and `family_name` field, both
exist and are well typed.

## Shapes in the Graph

As we saw with the JSON example, to describe trees or graphs, we need
recursive or mutually recursive definitions. We take all definitions
to be mutually recursive by default simplfying the definition of
shapes in our graph. For instance we can change the defintion of user
again to include friends in the following way:

```prolog
type user = { X : json | ∃ K ∈ keys(X) ⇒ K == "first_name" ∧
                         ∃ K ∈ keys(X) ⇒ K == "family_name" ∧
                         ∀ K ∈ keys(X) ⇒
                         if K == "first_name" then X.K : string
                         else if K == "family_name" then X.K : string
                         else if K == "date_of_birth" then X.K : dateTime
                         else if K == "friend" then X.K : set(user)
                         else if K == "pet" then X.K : set(pet)
                         else if K == "email"
                              then X.K : { Y : string
                                         | Y  ~= "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}" }
                         else X.K : value }

type pet = { X : json | ∃ K ∈ keys(X) ⇒ K == "name" ∧
                        ∀ K ∈ keys(X) ⇒
                        if K == "name" then X.K : string }
```

Simply adding a property with a type range of user to our
specification allows us to define a social graph, or an ownership tree (as is the case with pet).


## Prefixes and Namespaces

Information coming from multiple different schemata need to have their
namespaces represented explicitly in the database to distinguish the
semantics of various fields, but they will often want to be *implicit*
when retrieved for processing, which aids simplicity of interface.

Explicit and careful naming of fields is a hallmark of the RDF data
universe, but is often not carefully thought of outside of it. We need
to be able to handle both cases with minimal effort.

In programming languages, there are very explicit methods for the
marshalling of semantics across name spaces, such that libraries can
be imported with well defined schemes for manipulating the approriate
associated code and avoiding clashes. This needs to also be true of
data for data model reusability to become a genuine feature.

Let's look at a few examples of the importation of names from other
namespaces which allow simple display while preserving separate
semantics.



### GeoJSON

First, let's look at GeoJSON, which is a JSON format that 


## Components of a database type



* A shape, which dictates satisfaction of some type regime
  - Local checking
  - Global obligations (referential integrity)
* A ascription, which transfers a structural typing to a nominal typing
* A naming scheme - which imposes requirements on the identifiers of a type

To segregate the nominal and structural universe

* Check that *any* rdf:type use is excluded from ascription in the
  schema OR matches the shape for the type described.
* Exclude any URI that is covered by a naming scheme OR ensure it is
  within the ascribed or inferred type of the naming scheme.

```prolog
type person = { X : json | ∃ K ∈ keys(X) ∧ K == "first_name" ∧
                           ∃ K ∈ keys(X) ∧ K == "family_name" ∧
                           ∀ K ∈ keys(X) ⇒
                           if K == "first_name" then X.K : string
                           else if K == "family_name" then X.K : string
                           else if K == "date_of_birth" then X.K : dateTime
                           else if K == "friend" then X.K : set(user)
                           else X.K : value }

type user = { X : person | ∀ K ∈ keys(X) ⇒
                           if K == "email"
                              then X.K : { Y : string
                                         | Y  ~= "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}" }
                           else X.K : value }
naming user = { 'base' : '@base::User/',
                'type' : 'Hash',
                'fields' : ["first_name", "family_name"],
                'template' : '{base}{fields}' }
ascribe type for user
```
