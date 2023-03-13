# Graph Inference and Views

Views, whether ephemeral or materialised, are widely used in
relational database systems to create *derived* data. New *view*
tables can be constructed which are the result of queries, simplifying
other queries, while not confusing what is derived and what is a
concrete fact.

Of course having inferrence in graph databases is nothing
new. Deriving new triples has been part and parcel of the RDF database
realm for ages.

But I would like us to think of things in a slightly different
fashion, one a bit closer to the ideas of a view in the RDMBS
world. That is, we will present inference as queries which fill the
instance data for *classes*.

## Restrictions on classes

The first and simplest kind of inferred class is essentiall a
*subclass*, which has no additional inferred edges, but acts merely as
a filter.


```json
{ "@type" : "Class",
  "@id" : "Person",
  "name" : "xsd:string",
  "age" : "xsd:integer",
  "friend" : { "@type" : "Set", "@class" : "Person"}
}
{ "@type" : "Restriction",
  "@id" : "Adult",
  "@on" : "Person",
  "@has" : { "age" : { "@gt" : 18 }}
}

```

This view allows us to restrict to only those `Person`s who meet our
age restriction.

Of course you could get the same effect with a query which filters,
but this approach can make for a more declarative and well documented
query.

It also means that your business rules can be placed in the schema,
ensuring that your front-end software does not have to change, just
because your definition of what an "Adult" is changes. This has big
positive impacts on agility.

## Derived Fields

But we don't have to stop there, we could make a view that has derived fields.


```json
{ "@type" : "View",
  "@id" : "Adult",
  "@on" : "Person",
  "given" : [{ "friend" 
  "@having" : { "age" : { "@gt" : 18 }}
}

```



```json
{ "@type" : "Restriction",
  "@id" : "NoDeathCert",
  "@on" : "ClaimCase",
  "@having" : { "death_certificate" : null }
}

{ "@type" : "Restriction",
  "@id" : "NoPolicy",
  "@on" : "ClaimCase",
  "@having" : { "policy" : null }
}

{ "@type" : "Restriction",
  "@id" : "NeedsService",
  "@on" : "ClaimCase",
  "@or" : ["NoDeathCert", "NoPolicy"] }

{ "@type" : "Restriction",
  "@id" : "NamesDontMatch",
  "@on" : "ClaimCase",
  "@having" :
  { "death_certificate" : { "name" : { "@var" : "DeathCertName"}},
    "policy" : { "life_assured_name" : { "@var" : "PolicyName"}},
    "@with" : "DeathCertName", "@neq" : {"@var" :{ "PolicyName"}}}
}

{ "@type" : "Restriction",
  "@id" : "NeedsAssessment"
  "@on" : "ClaimsCase",
  "@or" : ["NamesDontMatch"]
}
```



