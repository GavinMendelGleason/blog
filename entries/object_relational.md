# The Solution to The Object Relational Impedance Mismatch

Object Relational Mappings (ORMs) are really pervasive infrastructure
in the modern tech stack. They were already something of a thing when
I began my first serious programming job for a ChemInformatics company
just around the time of the first DotCom bubble.

The product (Afferent) had some sophisticated modules which did
searching of molecules (using hash-networks), planning and scheduling
for robots, and a reaction engine, which would *virtually* carry out
some number of chemical reaction steps defined by the user to try to
get a better understanding of what chemicals *might* be produced by a
given reaction which could later be compared to spectroscopy data to
find out what *did* happen.

But I think it is fair to say that the bulk of the code, and the bulk
of the development work went into the not so glamorous task of
marshalling data from Lisp objects (We were using [Common
Lisp](https://lisp-lang.org/)), into Oracle, and back again.

And this task was awkward. One of the senior engineers, Mike Travers,
had developed some really great tooling for simplifying the task, but
the problem is that there is, what has been called, an [Object
Relational Impedance
Mismatch](https://en.wikipedia.org/wiki/Object%E2%80%93relational_impedance_mismatch).

This *mismatch* intrigued me so much, that I've been thinking about
problems related to it ever since, and it has led me to be in *two*
graph database startups. Graphs are, in my opinion, 'The Right Way'™
to deal with the mismatch.

In TerminusDB, we store *data objects* and the relationships between
them in a way that is:

* Pervasively Indexed: We are fast to retrieve on any data which is
  stored.
* Transactional: We have acid transaction model built into the core.
* Data only: We do not store *methods* but we *can* store declarative
  queries.
* Marshalling uses JSON

These approaches remove the need for an ORM, and kill the object
relational impedance mismatch at the cost of requiring *two*[^1] systems
to model objects, the host system, and TerminusDB.

This approach gives us the best features of graph databases, document
stores and relational database systems, all at the same time.

Let's take a little detour to see why we solved the problem this way.

## What is the Impedance Mismatch?

![Relations in Category Theory](../assets/Relations_category.png)

Relational database systems are mature and powerful, with a simple
query languages (now almost universally some SQL variant), based on
the relational model. That is, you create *relations* between data to
model your problem.

Now, clearly it is possible to model many things using relations, as
the decades of software development on the basis of RBMSs
attest. However, *programming languages* are almost universally (with
the possible exception of Prolog) based on a very different
model.

That is, in programming languages we deal with *objects*. Even
functional programmers deal almost exclusively with objects, and
modelling by constructing functions between them. This creates a real
problem, since our main *storage* model is different than our
computational model.

## (Mis)steps on the Path to Object Utopia

There have been a lot of attempts to overcome this mismatch, and many
of them have worked more, or less, well.

### The ORM

The ORM is an attempt to build an object model, embedded in the
relational model, such that we can move data in and out, hopefully
with some sort of
[isomorphism](https://en.wikipedia.org/wiki/Isomorphism) (or at worst
a [Galois
connection](https://en.wikipedia.org/wiki/Galois_connection)). This is
what we did at Afferent, and it is apparently pretty widely done,
since Google says there are 8,250,000 results for "ORM solutions".

When we create objects in our database, we need to choose a large
number of different things to model.

1. Identifiers: First and foremost is choice of *object
   identifier*. We need to have some way to represent the objects
   identity, so that updates to the object is reflected in
   storage. What constitutes identity is also of issue (what kinds of
   *keys* do we want on our data).

2. Data type marshalling: We need to figure out how to represent all
   of our data types, and marshall them to a storage format our
   relational database supports. This involves a lot of complexity in
   modelling collections, enumerated types, and more prosaic things
   like dates.

3. Indexing: How can we get elements back quickly, and how do we tell
   the relational system that this is the case? We need to write down
   information beyond just the kinds of types that our programming
   language supports. Essentially we need an intermediate language.

In practice, once we get into using the system in anger, we end up
having to understand the complexities of three systems, our
programming languages object model, the intermediate ORM model, and
the database model. And it can often be challenging to make this work
correctly.

### The Object Store

The first approach that I played with to overcome our mismatch was the
*object store*. This approach creates a place to put our programming
objects *persistently*. It essentially creates a way to marshall our
programming languages current model in-and-out of something more
persistent than RAM.

This is a very appealing concept at first, but has a number of
problems, perhaps not insurmountable, but tricky none-the-less.

The first is that persistence immediately starts raising questions
about [ACID](https://en.wikipedia.org/wiki/ACID) properies. How do we
instigate a transaction? What is connected in a transaction? What
kinds of data can we marshall (file handles? streams? functions?).

We now also need additional meta-linguistic tools to describe how to
*index* so that we can find and explore objects sitting on our
persistent heap. Heaps with pointers can become messy places, and good
organisational principles for persistence are not the same as we
generally think about in programming languages.

Garbage collection also becomes a series issue. In programming
languages we often perform the ultimate garbage collection by halting
and restarting the program. This is impossible for the database, so
the garbage collection approach has to be sensible.

Here we've actually opened a can of worms that might be worse than the
ORM. And I'd wager this is one of the reasons that this solution is
not used.

## Matching the impedance

The best approach to the problem that I encountered was to build a
*graph* database. Instead of having pointers to memory objects, we
would store things in a more declarative fashion, much in the same way
as we might do in an ORM.

However, unlike *most* ORM approaches, I figured it was best to just
assume that most things should be retrievable in a reasonable time. We
seldom know precisely what we want to pay for ahead of time with
indexing, so we can make the modelling job easier by just indexing
everything.

Of course this only works if your indexing methodology is
[compact](../entries/graph_representation.md) enough that you can get
away with it! Which is part of the reason we have used succinct data
structures for representation.

The other choice was to explicitly ignore *methods*. Methods create a
lot of difficulties in modelling correctly, including problems such as
violations of the [Liskov substitution
principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle).

With TerminusDB you get data in and out as a JSON object, which is
well supported in virtually every modern programming language. This
makes it easy to manipulate in your language of choice, whether it be
functional or object oriented.

For instance, some data retrieved from our [Star Wars](../entries/star_wars.md)
example:

```json
{  "manufacturer": "Aratech Repulsor Company",
   "model": "74-Z speeder bike",
   "url": "http://swapi.co/api/vehicles/30/",
   "pilot": [
          {
            "label": "Luke Skywalker"
          },
          {
            "label": "Leia Organa"
          }
        ]}
```

Give TerminusDB a try and I think you'll find that modelling is both
simpler and more satisfying than attempting to wedge the problem into
an ORM. Good luck!

[^1]: In the near future we intend to include tools to mode everything you need in GraphQL's schema language, which will be useable directly by many popular programming languages leading to *one* modelling tool for objects rather than two.
