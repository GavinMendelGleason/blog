# What's the Difference: JSON diff and patch

What will the distributed data environment in Web3 look like?

How will we have a distributed network of data stores which allow
updates and synchronisations?

What is it that allows git to perform distributed operations on text
so effectively?

Is it possible to do the same for structured data?

## Web3

These questions are really at the heart of the *distributed* part of
web3. Web3 has other parts: immutability, cryptographic security,
etc. But these other elements do not answer how to perform
updates on distributed data stores.[*](#crdt)

In seeking the answer to these questions, I was led to see a rather
simple tool as foundational: JSON diff and patch.

JSON, because JSON is the structured data format for the web.  This
will continue to be true for Web3. Everyone uses JSON for just about
everything in our web architecture. Other formats are going to be
increasingly used as mere optimisations of JSON. Associative arrays
have the beauty of (*reasonable*) human readability, combined with
widespread native support in modern computer programming
languages. Both computers and humans can read it, what's not to love!

But what about the diff and patch part?

## The *use case* for diff and patch

A fundamental tool in git's strategy for distributed management of
source code is the concept of the *diff* and the *patch*. These
foundational operations are what make git possible. *diff* is used to
construct a *patch* which can be applied to an object such that the
final state *makes sense* for some value of *makes sense*.

The application of patches happens because we want a certain *before*
state to be lifted to a certain *after* state. The patch doesn't
specify everything. Only what it expects to be true of the source, and
what it expects to be true after the update.

With this it's possible to have distributed updates performed on
different parts of source text. Collisions result in some remedial
action being required, but if there are no collisions everything can
be *merged* to obtain a final state which respects all updates, no
matter when or where they came from.

This is what allows git to be fully multi-master, without requiring or
forcing synchronisation using any complex protocols (like RAFT).

## Diff and patch in structured data

Do similar situations arise with structured data?

Definitely.

Let's imagine an object which stores information about items in our
online store.

```javascript
{ "id" : 13234,
  "name" : "Retro Encabulator Mark 2",
  "description" : "The Retro Encabulator Mark II is the lastest 
                   development of the Retro Encabulator used to 
                   generate inverse reactive current for unilateral 
                   phase detractors."
  "category" : "Cardinal Grammeter Synchronisers",
  "price" : { "value" : "3430.23", "currency" : "Euro" }},
  "stock" : 32,
  "suppliers" : ["Supplier/123","Supplier/4332"] }
```

If Alice opens the object in an application and changes the name of
the item to "Retro Encabulator Mark II", it should be possible for Bob
to update the suppliers list simultaneously without either stepping
on each others toes.

In applications this sort of curation operation is often achieved with
a *lock* on the object. Which means only one person can win. And locks
are a massive source of pain, not only because you can't achieve
otherwise perfectly reasonable concurrent operations, but because you
risk getting stale locks and having to figure out when to release them.

But what if Sally didn't submit her whole object for update, but only
the part she wanted changed? And Bob did the same?

Now we can perform the updates in three different places, locally for
Alice, locally for Bob, and then finally at a shared server resource.

The structured patch could be determined by looking at the object
*before* Alice submitted it, and after, using `diff`. The patch
constructed from Alice's diff might look like this:

```javascript
{ "name" : { "@before" : "Retro Encabulator Mark 2",
             "@after" :  "Retro Encabulator Mark II"}}
```

And Bob's might look like:

```javascript
{ "suppliers" : { "@before" : ["Supplier/123","Supplier/4332"],
                  "@after" :  ["Supplier/123","Supplier/4332",
                               "Supplier/385"]}}
```

Now both can apply cleanly to the original document listed above. We
can stack either patch in any order without difficulty. Perhaps we ask
Bob and Alice to agree on the application order (using pull / push as
is done with git). But maybe we just allow them to apply when they
arrive. The answer depends on the workflow.

## Conflict

But what if Mary comes in before Alice and submits the following
patch:

```javascript
{ "name" : { "@before" : "Retro Encabulator Mark 2",
             "@after" :  "Retro Encabulator Mark two"}}
```

We have a problem. But we see immediately that the two are in conflict
and Alice can be asked to resolve the question by surfacing it. In the
case of data curation this is a perfectly reasonable workflow. And it
is this problem of data curation that we can solve with the simplest
version of JSON diff.

This conflict can be surfaced to Alice, and Bob can be allowed to go
about his business. Could this particular problem be resolved in a
purely automatic way with a CRDT? Definitely, but it probably will not
result in what you want. Last first will work of course, but then
which is *more right* might need human review, and even worse it might
result in both results being interleaved (a likely outcome!).

We *could* make the before and after, however, be a text-based patch
using a textual diff. Probably gits line-based approach is *not* what
we want here, but rather one that takes words as atoms. It will not
solve this particular conflict, but it could make text fields much
more flexible.

Which of these you want, however, requires *semantic direction* of the
diff algorithm. While lots of structured diff problems will be solved
by the simplest algorithm, ultimately we need to have a schema which
helps to direct the meaning of our diffs. String fields might be best
line based, word based, or perhaps they must always be atomic (as with
identifiers).

## Patch is simpler than Diff

Patch is actually the simpler operation. Patch application basically
just checks that the read state matches, and then substitutes the
writes.

Diff by contrast has to calculate, and often in practice *guess* a
good transition from the read state to the write state. The specific
tuning of the patch provided by a diff is dependent on the needs of
the application. There are *generic* algorithms that can work decently
for a range of applications, but there is no one size fits all. This
is why we will need the *semantic direction* which can be provided by
a schema.

Diff is also computationally *much* more expensive. Finding the
minimal change means finding the maximal similarity. As it turns out,
this is pretty easy for the skeleton of a JSON dictionary, but rather
a pain for lists, and strings. And for lists of lists... Well, I'll
get into that later.

Let's just say it's no exaggeration that you can easily wander into
the heat-death of the universe. Hence heuristics have to be part of
any fully automatic diff.

## A Complex Patch gives rise to Distributed Transactions

But there are other workflows which might want slightly more flexible
approach to ensuring data integrity. The *before* state is really
sitting there to specify the *read object model*. It tells us what we
want to be true when we apply the patch.

With git this might be lines of text. For instance, to change a very
simple `README.txt` which initially says `hello world` to one that
says `hello squirrels`, git will produce a patch that looks something
like the following:

```
index 3b18e51..3a9ea5d 100644
--- a/README.txt
+++ b/README.txt
@@ -1 +1 @@
-hello world
+hello squirrels
-- 
2.32.0
```

This isn't the most compact patch, and it will conflict if hello were
changed to some other word, for instance `greetings` perhaps. The
reason that it works well for git is that lines of text are a somewhat
reasonable granularity for programming languages.

But the before and after don't have to be lines or words. The before
could be any specification of the read state. For a bank account
withdraw, we might ask for the before state to be larger than, or
equal to the after state. This would be a nice little transaction for
ensuring we don't overdraw.

Or perhaps we want the before state to be specified with a regex? Or
maybe we read a *lot* of values in order to calculate a further value
in the object, in which case we want to know that *none* of these
values change.

This approach gives us a kind of read isolation which is *tuned* to
the use-case we're actually working with. Making patch the unit of
update gives us just the right granularity for our application, which
really can't be known in advance.

This is an advancement beyond the sort of isolation options usually
provided by a database, and one that extends naturally to objects or
graphs of interconnected objects (as exists in TerminusDB).

## What we have and where we are going

I've implemented a simple JSON diff and patch in TerminusX. But we're
also working on the extensions of this to those specified by a
schema. It's also easy to implement and very interesting to imagine a
full space of patches, many of which could never be determined by a
diff, but which would be extremely handy to have for distributed
transactions over document stores. We will be adding these various
operations as we run into use-cases in practice, but we're also very
keen to hear about use cases that people have already encountered in
the wild. Do let me know!

<a name="crdt">*</a> CRDTs answer this question for certain types of
data structures - but not for all. Only certain *types* of
data structures can be updated with these approaches. In addition, many
updates require human aided review and will never require a
CRDT. Still others will have *object read model* conditions which can
not be specified in a CRDT. Ultimately our databases should support a
range of distributed datatypes including CRDT.
