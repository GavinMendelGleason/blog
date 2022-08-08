# The Semantic Web is Dead
## Long Live the Semantic Web!

The Semantic Web is rarely mentioned these days, so seldom that the
declaration of its death could be met by most of a younger generation
of programmers with a question: "The Semantic Who?"

This change in status is significant, but in some ways the Semantic
Web was on life-support since inception, and it continued to survive
only with the medical intervention of academic departments who had no
need to produce useable software or solve serious industry needs.

That's not to say that Semantic Web technologies *never* served any
industry needs. They certainly did so, but their penetration was
limited. And this limited penetration was not the result of mere
ignorance on the part of data architects or software engineers. It was
almost entirely the fault of deep problems with the ideas in the
Semantic Web itself.

## Why is the Semantic Web a Great Idea

The Semantic Web's demise is a tragedy, because we need the Semantic
Web. But as with all things in life, one must adapt or die, and the
adaptations of the Semantic Web were late, ill advised, and did not
address the core problems which led it to be the wrong approach in the
first place.

Why do we need the Semantic Web?

Because distributed, interoperable, well defined data is literally the
most *central* problem for the current and near future human
economy. Knowledge is power, and distributable, actionable knowledge,
creates opportunities and efficiencies impossible with out them.

We need this. And we do not have this. Yet.

The Semantic Web set out ambitiously to solve this problem, but the
problem remains. My experience in engineering is that you almost
always get things wrong the first time, then you take that experience
forward and fix the core problems. Eventually you might get something
that really sticks.

The analogy of the World Wide Web here is also deeply suggestive of
what *might* be possible.  We have an incredible world wide system of
document storage and retieval, the WWW. These documents are intended
to be presented and (since Web 2.0) interacted with. But the problem
of getting machines to talk to eachother about the most basic records
in a sensible way is still open.

The Semantic Web was going to fix this. We would have not only
structured documents, but structured data. We would be able to
describe not only records, but the *meaning* of records. The records
would allow machines, which could be given access to *meaning* to
infer consequences from the data. We were going to have a rich distributed
data environment that would get richer with contributions from people
all over the world.

It would be like wikipedia, but even more all encompassing, and for
more transformational. The effect of the Weather in Ireland on cow
prices, would be directly accessible in a live manner, and could be
used to compute the likely costs of a steak at the super market. Live
feeds of wind data could be accessed to provide continental balancing
operations for the grid.

In short, the information age needs an information super-highway and
not just a big pipe for interactive documents.

## Key Innvoations

The core ideas and aims of the Semantic Web were largely correct.

We should use a very flexible data structure, and a graph is very
flexible. Every data model which is not computation can fit in a
graph, and abstract syntax trees can easily represent intended
computations.

The ability to reference data resources means that we need large
unambiguous identifiers. IRIs are able to solve this problem (though
there is still much ambiguity about the *meaning* of the IRI and its
relationship to dereferencing).

We need a rich language to describe what the content *is* and what it
means. Communicating information about our information is as important
as the information itself.

## Where it all went wrong

But from here on out, the Semantic Web begins to make some serious
errors that basically made it impossible to gain large
acceptance.

### The Format

The first problem is really 20/20 hindsight. Triples can be used to
describe a labelled graph. That is, we can have three parts, S, P, and
O and use this to denote the origin, labelled edge, and target
respectively. It might look something like:

```turtle
http://example.com/a http://example.com#p http://example.com/b
http://example.com/a http://example.com#name "a"^^http://www.w3.org/2001/XMLSchema#string
http://example.com/b http://example.com#q http://example.com/a
http://example.com/b http://example.com#name "b"^^http://www.w3.org/2001/XMLSchema#string
```

This is great because we are representing our graph with long names,
presumably within a context where *our* definitions are under our
control. This is deeply important if we want a large world of
distributed data. We even have some terminals in our graph with *data*
which can allow us to representing typical datatypes which we do not
want to weave out of the graph individually (Peano arithemetic would
be a bit much).

And if we're lucky, we can make it possible to disclose information
about the meaning by attempts to *dereference* them using the given
protocol. Very meta.

This graph above represents a simple loop, but as we can see, is a bit
hard for a human to read. We can fix this by defining some prefixes
`ex:` to mean `http://example.org/stuff/` and `exs:` to mean
`http://example.com/stuff/schema#` and `xsd:` to mean
`http://www.w3.org/2001/XMLSchema#`.

```turtle
ex:a exs:p ex:b
ex:a exs:name "a"^^xsd:string
ex:b exs:q ex:a
ex:b exs:name "b"^^xsd:string
```

That's certainly a bit better. However, redunancy is not our friend
here. It's easier again to read using the Turtle format, which allows
us to refer to prior lines of inromation as a short hand. This is good
for human readability, but also for computers, which have to read less
information (which becomes an issue when graphs are huge).

```turtle
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/stuff/> .
@prefix exs: <http://example.org/stuff/schema#> .

ex:a exs:p ex:b ;
     exs:name "a"^^xsd:string .
ex:b exs:q ex:a ;
     exs:name "b"^^xsd:string .
```

So far so good. We now have a way to represent graphs which can be
communicated. Unfortunately few programming tools have any way of
reading this into an easily manipulable data object. XML was a
contender, and XML indeed can represent these graphs in an alternative
syntax. But XML, despite vastly larger uptake by industry, is falling
into disuse itself because it is verbose, hard to read, and similarly
hard to manipulate.

While all of this was taking place, JSON was becaming the defacto data
interchange standard. Many in the Semantic Web community scoff at JSON
and vocally claim it is a mistake. But Vox populi vox Dei.

JSON and the related YAML are among the best data interchange
formats. They are fairly easily read by humans, they map directly to
vastly popular datastructures which are ubiquitious now in programming
languages (the associative array) and extremely well supported for
lookup, iteration, pretty printing and update.

XML by contrast is a bear to look at. And neither is it very fun to
process XML documents while using a programming language (although
prolog actually fits pretty naturally on XML as a query language).

In an alternative world were Lisp won before the AI winter, we might
have ended up with S-Expressions, but even these are probably worse as
they do not make naming of the keys mandator, leading to less
readability without more context.

I'm absolutely positive that people are going to complain that syntax
is just syntax, how things are serialised is superfluous and that a
good library can make it easy to use INSERT MY THING HERE. But these
people are wrong and they will drift into obscurity the same way that
Turtle and XML will. Naming is deeply important, it is no mere
triviality, so how much more important is sentence structure?

Of course there is JSON-LD. This was a very serious attempt to bring
Linked Data into the JSON developments, and should be applauded. It is
however, needlessly verbose as an interchange format. I'll explain
more later.

JSON, and relatives are still expanding and will continue to do
so. The Semantic Web of the Future will embrace this fact.

### The Logic

There are many different and overlapping standards which define
Semantic Web technologies, but I think we can focus on OWL which
represents one of the most serious attempts to create a formal basis
for the discription of data.

The idea of representing the structure of data in a data structure
that is the same as the data is of course not a new idea (Think S-Exp)
but it is a good one. And OWL took this up. OWL is defined to use the
same kind of turtle format as above.

The problem with OWL is that it solved a problem, but not one that
anyone wanted solved. It also did it in a very hard to use way. So
hard to use that almost nobody has successfully used it. I've tried,
and I've written many machine checked proofs in everything ranging
from [Atelier B](https://www.atelierb.eu/en/atelier-b-tools/), through
[FDR4](https://cocotec.io/fdr/) to [Agda](https://github.com/agda/agda)
and [Coq](https://coq.inria.fr/).

Maybe I'm not the sharpest knife in the drawer, but I've written
significant proofs in these diverse languages, and never experienced
the same pain.

What is OWL *supposed* to do. It's supposed to be an Ontology
language. That is a language that reasons about the categories of
things, and how they inter-relate. It is related, and a superset of
(Description Logics)[https://en.wikipedia.org/wiki/Description_logic]
used in several specialised areas in which the codification is both
complex and very important such as biomedical knowledge.

It however makes some fatal errors that impede its use.

First is that types are easier for programmers to work with than these
logical languages. Types are important, not just in low level and
compiled languages, but increasingly in dynamic languages such as
python and javascript. Speed is just one benefit of telling the
computer what you mean. Another benefit is that the computer can tell
you if what you mean is garbage.

And this is why OWL is such a bear. It is very easy to tell OWL you
mean something and it just believes you.

For instance, in a programming language, if I define a class A as a
subclass of class B, and then define a class B as a subclass of class
A, it will most likely complain. In OWL it will just equate class A
with class B.

This sort of equivocation by circularity is virtually *never* what one
means. Yet I found numerous examples of these cycles in wild
OWL. Nobody noticed them because OWL really had no problem with them,
and it is not unless you actually check what inferences arise that you
can see the problem.

And this is not unsual. One of the formalisers of OWL said this:

!(Inconsistencies produce nonsense more than obvious contradictions, and often when long inference chains are followed. @ImageSnippets
 found one in Wikidata that implied that native Americans are insects, another that Paris is an 'abstract media type'. I'm sure there are more.
)[/home/gavin/Pictures/Screenshots/Screenshot from 2022-08-08 14-39-49.png]

The logical approach simply gives the practitioner too much rope to
hang themselves, with very little feedback. An advanced researcher can
discover these logical conundra but it is too much mental burden for
every day use.

What caused this problem to arise, and what do we do about it?

### Lets make everything the same

First, not having a (Unique name
assumption)[https://en.wikipedia.org/wiki/Unique_name_assumption]"No
Unique Names Assumption" is a mistake. Plain and simple. This is the
idea that any two URIs might actually mean the same thing unless we
explicitly say otherwise. This is a terrible idea for computers in
much the same way as it is for humans attempting knowledge
representation.

If you want something to be the same you should be forced to say
it. Aliasing is a nightmare, computationally expensive and leads to
difficult to understand reasoning.

The second mistake serious mistake is the Open World Assumption, the
converse of the (Closed World
Assumption)[https://en.wikipedia.org/wiki/Closed-world_assumption]. This
assumes that there is as yet ungathered data, forcing us to reason
only about what we have at the minute. This might sound like a clever
proposal but in practice makes reasoning weak.

Basic things like checking that we have exactly one name for someone
become stupidly complicated with the overlap of the above two
rules. OWL would rather make two people the same, then complain that
you've done something wrong.

### Polluting the Data with Inference

While you can use OWL to talk about your data model, you can also use
it to enrich your data from the model. This sounds brilliant because
we often want calculated information. However, in practice this is
never so nice as a (view)[https://en.wikipedia.org/wiki/View_(SQL)] is
in SQL. Why?

The reason is that with a view you create a new distinct resource
which is calculated. With clever technology you can update the data
and get a new view updated automatically. Some advanced databases even
have ways to insert into a view to update the original tables.

In OWL we entail things into the graph which then look just like the
data from which it was entailed. This makes life complicated when
trying to distinguish from information you got from the real world,
and information that you got from some chain of reasoning.

And chains of reasoning can be very fraught, pollute the database. In
practice I often found that things were performed as a batch load
process to avoid the problem by restarting with new data. This is of
course a ridiculous way to work with a large database.

The dream of computers which reasoned about data as it arrived to
create some great symbolic AI, without a
(Doxastic)[https://en.wikipedia.org/wiki/Doxastic_logic] approach is
frankly silly.

### Not much in the way of useable constraints, sorry

And we can't use OWL to provide effective constraints over data. This meant that 



### The Right Way (TM) is Right In Front Of Us


You can't actually use OWL as a language to ensure

Then there is trying to 

First, while knowledge representation and data modelling are critical, these sort of First-Order logical tools are an awkward 


There are of course many who will disagree with my takes
here, but the proof is, as they say, in the pudding. And if you
disagree with them, you're going to have to answer what the real
problem is.

## Academics and Industry

## The Future of the Semantic Web

