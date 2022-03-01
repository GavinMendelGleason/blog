# Mergeable Records: A Data Modelling Approach
## How to use Duplicate Detection to create Unique Entries.

What happens when you have two records which are really meant to be
one?

Most people with a cell-phone have encountered this problem with
duplicate contacts. The problem of recognising them is tricky, but
when you find the duplicate, you've got another problem: merging them.

[Duplicate record detection](https://en.wikiversity.org/wiki/Duplicate_record_detection)
is a very richly studied field with lots of techniques which are used
to provide efficient methods of recognising duplicate entities in
large data stores. I will not be going into that problem in detail
here (though I may describe how we do it at TerminusDB at a later date).

Instead I want to look at the problem of merging them, once you have
already found them.

## Provenance and Time scoping of Data Values

In the wild when we encounter data, we often have a *source* from
which the data comes. Not only that, we have *different* information
about the same entities from different sources.

I have encountered this problem in a very wide variety of entity
modelling problems in the wild, ranging from recording historical
information, such as the population of Rome through to the subsidiary
share holdings of a company.

In both cases, the information is time-scoped. Rome's population is
not only uncertain, and being reported by a source, but it is
purporting to do so for a specific time.

Similarly, when we have a record of a stock holding by a company, we
have it being purchased at a specific time. And of course, this
information comes from somewhere. Either some provider of business
intelligence, or perhaps scans of actual documents.

And to make matters worse, not only is the information from a source,
and time-scoped, but it is *also* inconsistent. It can disagree,
depending on what source it came from. And disagree it does. In
practice we can have lots of sources disagree but the name of a
company, it's address, the number of employees. And of course the
population of Rome in 0AD might have more answers than the population of
Rome.

"surely there is some correct answer!", you say.

Well, that may be, but we may not be able to decide which it is, at
least not immediately. And luckily we don't have to, we can use all of
the answersq. Perhaps later we may want to have tests for accuracy of
a source, or perhaps we have other information that allows us to
perform selection, and maybe we just make selections
probabilitistically!

In logic, being able to entertain multiple truths, simultaneously,
without disappearing into a puff of smoke is known as [paraconsistent
logic](https://en.wikipedia.org/wiki/Paraconsistent_logic). We need a
variety of this with *provenence*, which records the origin of the
data. While obscure, in practice this a very fruitful way to model
real world problems.

## A Simple Example: Company Records

To get a handle on how we might do this in practice, let's look at how
we might model a company in our schema.

```json
{ "@type" : "Class",
  "@id" : "Company",
  "name" : "xsd:string",
  "employees" : "xsd:integer"}
```

And a document which conforms to this schema might look like:

```json
{ "@type" : "Company",
  "@id" : "Company/TerminusDB",
  "name" : "TerminusDB",
  "employees" : 17 }
```

This is a very simple company record where we want to model the number
of employees.

As we mentioned earlier, however, we need to know *when* this
information happened and *why* we know it. Let's expand the company
record a bit to give it a bit more variety.

```json
{ "@type" : "Class",
  "@id" : "TemporalScope",
  "at" : "xsd:date",
}
{ "@type" : "Class",
  "@id" : "Source",
  "name" : "xsd:string",
}
{ "@type" : "Class",
  "@id" : "Employees",
  "@inherits" : ["TemporalScope", "Source"],
  "@key" : { "@type" : "Lexical",
             "@fields" : ["name", "value", "at"] }
  "value" : "xsd:integer"
}
{ "@type" : "Class",
  "@id" : "Company",
  "name" : "xsd:string",
  "employees" : { "@type" : "Set",
                  "@class" : "Employees"}
}
```

Well, things are a bit more complicated. We've changed `"employees"`
to be a `"Set"`, which means we're going to allow any number of
(unordered) `"Employee"` documents.

What might one of the documents for this schema this look like?

```
{ "@type" : "Class",
  "@id" : "Company/TerminusDB",
  "name" : "TerminusDB",
  "employees" : [{ "@type" : "Employees",
                   "at" : "2022-03-01T17:44:52+01:00",
                   "source" : "Gavin said so",
                   "value" : 17 }]
}
```

We have a source, a time at which it was reported, and a value, and
the employees value now lives in a set. This will be handy later. We
also establish an id for the `"Employees"` document by using a lexical
combination of the fields.

Of course before we go on, we should note that in practice we would
*also* want to change the name field to be like the `"Employees"`
field. Names of companies are not actually static in practice. They
change, and we have "doing-business-as", as well as slight differences
of spelling etc.

```json
{ "@type" : "Class",
  "@id" : "Name",
  "@inherits" : ["TemporalScope", "Source"],
  "@key" : { "@type" : "Lexical",
             "@fields" : ["name", "value", "at"] }
  "value" : "xsd:string"
}
{ "@type" : "Class",
  "@id" : "Company",
  "name" : { "@type" : "Set",
              "@class" : "Name"}
  "employees" : { "@type" : "Set",
                  "@class" : "Employees"}
}
```

## Merging Records

Now that we have records scoped by their source and time, as well as
the fields pointing at *sets* of these scoped values, we can very
easily merge records.

Supposing we have the following two records which we have identified
as being duplicates (perhaps by their company id in the company
registry which I have left out for simplicity).


```json
{ "@type" : "Class",
  "@id" : "Company/TerminusDB",
  "name" : [{ "@type" : "Employees",
              "at" : "2022-03-01T17:44:52+01:00",
              "source" : "Gavin said so",
              "value" : "TerminusDB" }],
  "employees" : [{ "@type" : "Employees",
                   "at" : "2022-03-01T17:44:52+01:00",
                   "source" : "Gavin said so",
                   "value" : 17 }]
}
```

and

```json
{ "@type" : "Class",
  "@id" : "Company/DataChemist",
  "name" : [{ "@type" : "Employees",
              "at" : "2020-01-01T20:24:32+00:00",
              "source" : "Luke said so",
              "value" : "DataChemist" }],
  "employees" : [{ "@type" : "Employees",
                   "at" : "2020-01-01T20:24:32+00:00",
                   "source" : "Luke said so",
                   "value" : 5 }]
}
```

Now a merger of the two records is as easy as literally appending the
lists together.


```json
{ "@type" : "Class",
  "@id" : "Company/TerminusDB",
  "name" : [{ "@type" : "Employees",
              "at" : "2022-03-01T17:44:52+01:00",
              "source" : "Gavin said so",
              "value" : "TerminusDB" },
            { "@type" : "Employees",
              "at" : "2020-01-01T20:24:32+00:00",
              "source" : "Lukee said so",
              "value" : "DataChemist" }],
  "employees" : [{ "@type" : "Employees",
                   "at" : "2022-03-01T17:44:52+01:00",
                   "source" : "Gavin said so",
                   "value" : 17 },
                 { "@type" : "Employees",
                   "at" : "2020-01-01T20:24:32+00:00",
                   "source" : "Luke said so",
                   "value" : 5 }]
}
```

## Dealing with Merged Records

This type of merger is both easy to write, a couple of lines of python
for instance, and gives us a *better* model of information. The
downside is complexity of the data and the queries. Queries now have
to be more explicit about *what* we want to surface. But then what
*should* such a record look like?

You *could* add a default name and employee field to the records, and
promote one of the answers. Possibly the latest answer, possibly the
*best* answer, maybe according to who is most reliable. Or perhaps
this is just a question of UI display, and we take the latest best
record, or something which the user specifies in preferences.

So while we have made things a bit harder to look at, we've made it
match what the data actually means more closely, and made it easier to
update, and easier to enrich.

There are other things you might want to do, perhaps more structured
information in the source information, or the like. But this is a good
starting point for modelling entity records in a wide variety of
situations in which we can expect to collate information from multiple
sources.


