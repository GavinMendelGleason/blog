# The Content Revolution
** Building the Headless Content Management System of the Future **

We live in the information age, and unsurprisingly that means a *lot*
of what we do with computers is about marshalling, finding or
transforming data.

Each domain which IT serves involves creating digital assets which
record information to be enriched, served up, or curated over
time. And much of this data is *highly* interconnected.

More-over, it is being loaded, curated and enriched by a combination
of humans and computers. The entire business is fundamentally
cybernetic. We need *knowledge graph management systems* which include
easy to use interfaces for human data entry, review and curation at
the same time that they facilitate the same from a computer. These
systems have to be scalable and distributed.

And as AI grows in importance, the imporance of well structured data
will simply grow. AIs perform better when fed well structured data,
and they will be able to helps us create the search engines of the
future. It will make expert systems something more like asking an
expert, and less like a tool *for* an expert.

Our infrastructure for creating and managing the data world is still
young, so the question is, how is it going to change? We have
databases, including graph database, we have headless content
management systems, what more could we ask for?

As a practitioner in managing data, I developed strong opinions on the
matter, and made some big bets on what I thought was important by
making TerminusDB.

What is currently missing in our data management solutions? I think it
essentially boil down to the need for:

* Continuous integration / Continuous development (CI/CD): data is
  always in a pipeline
* Document Graph structured content: Content always relates to other
  content and we need to manage content with both people and machines.
* Discoverability: We require powerful query and search (drupal /
  wordpress aren't going to cut it)

None of these ideas are completely new. In fact all of them are widely
used in their respective domains, but they aren't currently being used
together for data management.

To hit these functional requirements we need a headless, schema driven
knowledge graph management system with external transactions for CI/CD... right,
what does that mean... Let's unpack that...

## CI/CD for Data
Transactions in databases tend to be focused around the central
server. This makes a lot of sense when you want high performance ACID
transactions and a single source of truth.

However, there are more kinds of transactions than the text-book
"decrement a bank account" variety. Content management by humans is
often more natural to think about with transactions which could be
open for a long time.

In software engineering we already do this with code. Change requests,
ala Git, are *external transactions*. What do I mean external
transaction? It's a transaction id which associates a state, which can
be used with many individuals or microservices to perform a pipeline
of updates on the request branch - and which finally completes only
after everything is in order.

To do this we need state which sticks around and which can refer to
other state. We need a graph of states and their
relationships. Basically we need a git like architecture for our
database.

A typical workflow with a change request might be:

(I'll use `cN` to refer to the names of individual commits)

1. I branch from main with a change request branch which I name
   `dev`. Initially we share a commit `c0`.

```
       c0
main – ∘
       |
      dev

```

2. I make some commits into this branch, adding data by human data
   entry with a front end I've designed to make data entry easy for my
   problem domain.

```
       c0
main – ∘
        ↘
  dev –  ∘
         cd1
```

3. A computer programme sees this change request update and enriches
   my added documents, by performing named entity recongition on the
   text, enhancing searchability.



```
       c0
main – ∘
        ↘      dev
         ∘      |
         cd1 → cd2
```

4. A spell checker runs on cd2 highlighting errors, which I think fix.


```
       c0
main – ∘
        ↘
         ∘ → ∘ → ∘ – dev
        cd1 cd2 cd3
```

5. Now, my cd3 gets a green light from all of the linting
   operations. that run on commits in CRs. It's ready for a human
   review. An editor sees it, likes it, and decides to merge it to
   main. However, main has moved on... some other changes have taken
   place (perhaps another curator, maybe an automatic
   ingestion). These need to be merged back into dev.


```
                        main
       c0          c1    |
       ∘ →→→→→→→→→ ∘  →  ∘
        ↘            ↘ ↗
          ∘ → ∘ → ∘ → ∘ – dev
         cd1 cd2 cd3  cd4
```

Everything in this process is already possible with
TerminusDB. However, there is more yet to be done.

## Document Graphs

Structured documents are widely used by both computers and
humans. These include everything from Excel and Word documents which
are more human focused, to [Protocol
Buffers](https://en.wikipedia.org/wiki/Protocol_Buffers) and JSON
which use documents which are more machine focused.

HTMLs great innovation was to introduce into this idea of documents,
the concept of the hyper-link. This would allow documents to refer to
other documents.

HTML however was focused on *rendering* (Mark-up) rather than
structured content. This means that HTML actually makes poor documents
for machine manipulation.

In TerminusDB we have allowed structured content to use references to
other documents, which gives us the power of both the graph, and
document orientation, and allows machines to process documents more
easily. Rendering can be thought of more as a publishing step of
processing the structured knowledge graph data, and less as something
which is built directly into the structured content.

It is also possible to mix-and-match, keeping the content as mark-up
(or markdown) while having more structured accompanying information as
well - as in the info-boxes on Wikipedia. For instance, a Politician
might have a description renderable as markdown, but positions which
could show up in an info-box, or be searched easily, or processed by
other machines.

```json
{ "@type" : "Class",
  "@id" : "Position"
  "party" : "xsd:string",
  "start" : "xsd:date",
  "end" : "xsd:date",
  "position" : "xsd:date",
}
{ "@type" : "Class",
  "@id" : "Politician",
  "description" : "Markdown",
  "positions" : { "@type" : "Set",
                  "@class" : "Position" }
}
{ "@type" : "Class",
  "@id" : "Markdown",
  "@metadata": { "render_as": { "value": "markdown" }},
  "body" : "xsd:string" }
```

## Empowering Cybernetic Cyborgs
This cybernetic approach is designed based on iterative processes, and
bio-mechanical. Ultimately we hope to do more to facilitate this
approach to data management to make it more scalable and more
*external*.

Right now, we are adding information to commits about what objects
changed to facilitate queries over histories, but we'd also like to be
able to retain information about *read-sets*. I read set is all of the
data which you read that was necessary to make a transaction
work. This information can allow you to reorder transactions, while
retaining the Isolation part of
[A.C.*I*.D](https://en.wikipedia.org/wiki/ACID).

This could allow you to have long running transactions that can commit
*out of order* with others, retaining isolation, as long as none of
the information required for the completion invalidates the
information. It also makes it the responsibility of the commiting
transaction to know whether or not this is the case, taking the load
off of the central server, which can not in *principle* know what
precise isolation level is acceptable.

To give a case in point, I could have a user class as follows:

```json
{ "@type" : "Class",
  "@id" : "User",
  "name" : "xsd:string",
  "email" : "xsd:string",
  "credits" : "xsd:integer"
}
```

Now, we might want to perform a transaction that looks up the number
of credits, finds them to be 20, and then commits the transaction if
so. If the granularity of isolation is, however, the object, then
people changing the users name will conflict. This is almost certainly
not what is meant, but the DBMS can't know this. With *read-sets* you
could.

In fact, you could even have *amended* transactions which just tack on
a bit on the end to make things consistent. For instance, you could
decide that the User needs >20 credits since 20 will be deducted. One
starts with the read of 30 credits, comes back to commit and finds 25,
and hence the commited number should be 5, which we could paste
together in an amended transaction and complete.

This is a form of automated conflict resolution, and while not all
sorts of conflicts can be resolved without aborting the transaction,
it is possible to build logic around things like greater/less-than etc
which would work.

Further, it's entirely possible to ingrate CRDT data types into this
model to get a mixed view, when you really don't care about the
ordering of transactions on a field or the exact state of the original
or final read.

The approach of read sets and external transactions is very *general*
and therefore will be a powerful mechanism for sharing state not only
among humans, but also among micro-services.

## Conclusion
TerminusCMS is our latest attempt to put up a cloud service which
exposes some of the power of TerminusDB in a way that non-technical
users can enjoy, while also giving the full *headless* API to
developers. The tool is open source, and free to use on our cloud for
even quite large databases, so we hope you give it a try and give your
feedback!
