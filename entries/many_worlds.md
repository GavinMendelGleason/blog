# Many Worlds: a philosophy of data collaboration

Data collaboration is a key driver of modern organisational
success. No aspect of modern life is untouched by the need and
importance of data collaboration. It is really expansive, covering how
we share and edit documents (whether that be Word, Excel, text or
JSON), how we write databases and how we code.

I would like to present a somewhat analytic philosophical take on what
data collaboration is and how we should think about it.  I believe
that this will help us not only understand what we are doing now, but
where we need to go in the future to really achieve a more
*enlightened* approach to data collaboration.

## The Agreed Universe

Collaboration requires having a shared *view* of the world. It
*doesn't* require that we share absolutely *everything*. Coming to a
shared concept of the state of something is what data collaboration is
all about.

To do this, we need a bit of exploration as to where our assumptions
line up with those of others. In order to collaborate we need ways to
minimize the stomping-on of toes. Collaboration is therefore,
necessarily, a bit of a dance.

There are many ways to view this dance, but I think a special mention
should go to git.  *Git* really stands out as a tool for data
collaboration on one of the most complex types of data we have:
Code. And the way we do this collaboration is very different from the
way we collaborate with one of the other extremely widespread data
collabration tools: the database.

Now there are various kinds of databases, various replication
technologies, some very sophisticated and various levels of
[isolation](https://en.wikipedia.org/wiki/Isolation_(database_systems))
given which change the way we collaborate.

In order to think about *data* and *change*, we're going to stray into
a universe of multiple worlds which was perhaps best conceptualised by
[Saul Kripke](https://en.wikipedia.org/wiki/Kripke_semantics) from
whom we will borrow liberally. This philosophical framework is very
general, but it can also be very precise. This makes it a useful lens
through which to view our activities.

## Linear Worlds

The very concept of isolation, a core concept in database systems, and
the I in ACID, stems from the notion that databases should have *one*
current state of the world. Our transactions exist to construct
*movement* in this one world. Isolation allows us to ignore how others
are changing the world and focus on our own problems. Since nobody
likes having to deal with others problems, this is good news.

It is really convenient when transactional commits happen with reads
and writes that are scheduled relatively close to eachother and where
scaling vertically is not an issue. It works so well that databases
working on this model are absolutely pervasive in our computer
architectures.

Each database *query* tells us something about the state of the
current world. For instance, if we have a world `w` we can ask a
question `parent(X,Y)` where we get all `X` `Y` for which
`parent(X,Y)` is true.

```
Diagram:

w
⋆

Query:

w ⊢ parent(X,Y) ← {[X = jim,  Y = jane ], [X = jim,  Y = joe],
                   [X = kate, Y = elena], [X = kate, Y = tim]}
```

We can read this as a query at the world `w`, which gives us back all
substitutions of variables which would make the query true at world
`w`.

Here we have a world at which Jane and Joe are Jim's parents, and Tim
and Elena are Kate's parent. That's sensible enough, but we may need
to update this world when Jim and Kate have children.

This requires a *state transition*. We will go from a world `w` to `w'`
via some state transition `σ` (sigma).

```
w   w'
⋆ → ⋆
  σ
```

Let's say `σ` says that we are going to add a child Sarah of Jim and
Kate. We might write this as: `σ ̣≡ insert:parent(sarah,jim) ∧ insert:parent(sarah,kate)`.

Now we can get a different answer at `w` and `w'` for a question such
as the following:

```
w ⊢ parent(sarah,Y) ← {}

w' ⊢ parent(sarah,Y) ← {[Y = jim], [Y = kate]}
```

Different worlds have different facts. And we move from one world to
the next through an arrow (which we could call an accessibility
relation). The arrow is *transitive*, in the sense that we can follow
the arrow through any number of hops.

But these worlds we have pictured above are arranged in a *linear*
fashion. This is how we usually think of *our own* world. That is, we
generally think of there being a single time-line, and everything that
happens is shared for all participants. As those with a bit of
experience with quantum mechanics may know, this may very well *not*
be true! However it is *mostly* true at human scales. And it is
certainly convenient to think in this fashion as it is simpler. And
simpler is better when it's still right enough. In the words of Albert
Einstein:

> A theory should be as simple as possible, and no simpler.

## Locality in the Simulation

When we try to simulate our understanding of the state of the world we
inevitably find that we can't be everywhere at once. Locality is a
factor of the real world which is inescapable. At a physical level
this is because the speed of light provides an upper limit to our
communication times.

The fundamental locality of operations is something which we must
constantly contend with in software engineering and systems design and
architecture. The difficulty of *cache coherence* is perhaps
legendary, and reflects this fact. Databases are no strangers to the
problem. But it also arises with "real-time" collaboration software
like google docs or google sheets.

### Code

The way that we program with computer code is *step* orientated. In
compiled languages, we have to make a syntactically complete update, a
commit as it were, run the compiler and get an output. In dynamic
languages like javascript and python we generally update the state of
the program code and re-run the code after a similarly syntactically
complete change. Even in the now relatively rare *image* based
programming models which were used in Lisp and SmallTalk for instance,
updates would happen to a chunk simultaneously - perhaps a function,
class definition or a procedure.

The naturality of this chunk-at-a-time transition is why git's commits
are natural units for revision control. It also means that it is
convenient for our changes to be done in a *local* version which we
edit in a single chunk, and only later attempt to reconcile with
changes which might be made by others.

It is *possible* to have simultaneous editing of code by multiple
participants using other ideas such as
[CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
(Conflict Free Replicated Data Type) or
[OTs](https://en.wikipedia.org/wiki/Operational_transformation)
(Operational Transformations) which we will look at in a bit (these also
deal with the problems of locality by the way), they simply aren't
that *useful* since we don't know when the code is ready to compile
because the commit granularity of characters is too fine to make
sense.

Here it is useful to think of these commits as worlds. What is true at
a world is a state of a set of files. What we can query is the lines
in these files. We call these worlds things like: `77a407c` or perhaps
we give them temporary names like `origin/main` to refer to the most
recent version. They are also distinctly *not* linear.

```
             main
⋆ → ⋆ → ⋆ → ⋆
     ↘
       ⋆ →  ⋆
           dev

```

This non-linearity leads us to branching worlds. And here is where git
gets *really* interesting. We can *reconcile* histories by creating
new shared understandings through the process of [rebases]() and
[merges]().

Each state transition from one commit to another can be described as
some number of text line deletions and some number of line
additions. If these regions are non-overlapping we can perform a
*three-way-merge*.

This new commit essentially makes the diagram *commute*. We can think
of the new merge commit as arising from either of the two branches, as
a patch, both arriving at precisely the same final state.

```

                main
⋆ → ⋆ → ⋆ → ⋆ →  ⋆
      ↘       ↗  ⇑
        ⋆ → ⋆    merge commit
            dev
```

This ability to get a shared world from divergent ones is what forms
the backbone of git's success in acting as a *collaboration* tool. We
collaborate on code by finding acceptable shared worlds after having
made state transitions whose granularities reflect the cadence of
programm writing.

### Replication

Replication of databases means that we try to get local copies of a
database which are all the same, in some sense, and on some
timescale.

One simple approach uses a
[primary](https://en.wikipedia.org/wiki/Replication_(computing)#Primary-backup_and_multi-primary_replication)
for transactions and potentially multiple *backups* which replicate
the latest state of this database (for some notion of latest). The
strategy here is to keep the *linear timeline* (which we saw above)
which is to be organised by a single transaction processing server for
some transaction domain or shard. This tends to be much easier than
having some sort of communication which would resolve issues with
transactions.

However, more elaborate approaches which involve coming to
[consensus](https://en.wikipedia.org/wiki/Consensus_(computer_science))
also exist. These make the timeline *seem* linear to the
participants. But the secret underlying sauce in these algorithms is
that the timeline is *not* linear: We are actually dealing with
multiple worlds.

Our task is to make sure that some agent processes can up with a way
to arive at a shared final state which all participants agree
with. That is, the same final world state.

```
          (w₁ replicated)
      w₀ → w₁  → wₐ → w₂
             ↘       ↗
               w₁ → wₑ
```

There are also very clever ways of relaxing how our worlds come to
shared agreement. Instead of having to reduce immediately to `w₂`, we
can decide that our algorithm only needs to *eventually* get us
there. Intermediate reads, in different localities, will not get the
same world!

Sometimes this is good enough, and sometimes good enough is better
because its faster. If you have a monotonically increasing counter for
instance, you don't care if you add one now, or add one later. The sum
at the end will the same. People missing a bunch of up-votes when they
check their social media will not cause serious concern. They'll see
them in a few hours and perhaps they will never be the wiser.


```
          (w₁ replicated)
      w₀ → w₁  → wₐ → w₂ ...   wₓ (I eventually got joe's upvote)
             ↘               ↗
               w₁ → wₑ ... wₙ
```

### CRDT and OT

The *illusion* of a common resource which is provided by google docs
is a fantastic productivity tool. You can co-edit a document in
real-time and rarely does one think about *where* it is.

But it is actually somewhere! More correctly, it's multiple places at
the same time, in multiple different worlds with different states.

It is not a shared resource at all. Instead what we are doing is
creating replicas with a transaction processing system which can
*re-order* transactions.

When I edit a document I create some number of edit operations. These
edit operations are applied to my local copy of a document. I then
send these to google's servers.

```
me:
        w₀  →   w₂  →   wₙ
            σ₀      σ₁'
google:
         (joe,σ₁) (me,σ₀)
joe:
        w₀  →   w₁  →   wₙ
            σ₁     σ₀'
```

Google sends on the updates to the clients allowing client updates to
be *fixed* by transforming them. Hence the name OT: Operational
Transformation. We can get a linear world by taking google's view as
canonical, with the order of messages received. But each client can
update their view independently after receiving the updates such that
they are appropriately transformed.

Again, we are finding a way to agree on our final world state - this
time by reordering transaction updates such that we don't have to
agree them all in advance, which would make our application feel very
laggy and it would not have the illusion of being a shared resource at all!

Another way to achieve this same effect is with a CRDT. A CRDT[^crdt] builds
operations which *commute in the first place*. That is, it doesn't
matter the order of the operations, when they are applied they arrive
at the same final state. Of course this commutivity places a lot of
restrictions on *what* types of operations we can do. We certainly
can't have commuting bank transactions where you pay for your latte
from your empty bank account and then get paid. But it can do a lot,
and if you can make your `σ`'s commute then life is really great.

[^crdt]: CmRDT are based on commuting operations, but CvRDT use a commutative, associative and idemponent *merge* on states.

## What Pieces are Missing

I hope that seeing things laid out in a general framework which
unifies these very disparate ways of collaborating has inspired some
new ideas. It certainly has got me thinking about what we *don't* have
that we probably *should* have. What pieces are missing from the
collaboration puzzle.

### Structured Patches

The first is the concept of structured patches. This issue is very
 close to my heart as it is what we are currently working on at
 [TerminusDB](https://terminusdb.com), and I've written some
 preliminary thoughts about it in a discussion on [patches](https://github.com/terminusdb/terminusdb/discussions/686).

"There is nothing new under the sun" applies here. There are several
excellent papers on the question of patches for structured data which
I have pointed in my blog on [syntactic
versioning](https://github.com/GavinMendelGleason/syntactic_versioning). There
are example programmes which use these approaches which are open
source as well.

However I think it is fair to say that the use of patches on
structured data has not hit prime-time. The tools to make use of it
are not really there yet.

But perhaps more importantly, the scope of its power is not at all
appreciated. It is a way to communicate information in a way which can
make explicit *when things commute*. That is, the conflicts which
arise during merges in git are caused by non-commutative patches. And
this is the same things as a transaction which does not commute.

This fact, now that we know a bit of Kripke semantics, should
immediately remind us of the kinds of things we do in other
circumstances when things do not commute!

### Kripke Query

The other glaring hole in our current tech which becomes obvious when
we look at the states of the world as kripke structures is the ability
to query through worlds.

In git we actually have a fair number of tools for this. `git log` is
all about the worlds. Our git commands can *world-travel* which is
actually a super-set of *time-travel*. We can go to different
branches, as well as different views of how the world evolved.

But git is a very limited sort of database. It essentially has chunks
of text at worlds, with some associated metadata. With a real database
which had the ability to travel through worlds, whole new avenues open
up.

One of these is a *modal logic* query languages. Kripke semantics was
originally devised by Saul Kripke to create a semantics which could be
used for modal logics. And one obvious modal logic which might be
useful for databases is temporal logic.

What did we know at state `w`? This could be very important for
*auditing*. What decisions were made at some point in the past relies
on what knowledge they had at that point. If you don't know what you
knew, you can't evaluate if you did the right thing at that time. Of
course this would seem to be an almost no-brainer for regulatory
requirements.

This is potentially really powerful. A database constraint is
generally formulated as a proposition which obtains at every world. If
we know about our constraints as well as about our state transitions
(patches) then we can know more about these.

But we can also potentially make constraints like *eventually* or
other very powerful such statements such as are found in
[CTL](https://en.wikipedia.org/wiki/Computation_tree_logic).

Speaking in more practical engineering terms, we might ask for when a
particular object was edited last, and by whom or what algorithm. Or
when was the last time that a document refered to another document.

### Hypothetical worlds

When we are trying to resolve our updates to the world, sometimes it
is convenient to build a thought experiment: what would this world
look like if some as yet untaken actions took place.

Humans do this all the time with statements like, "if you were to go
to the store, would you get cheese, or biscuits or both?". Note this
doesn't require that we go to the store. We instead try to resolve
what would happen if we did.

In a computer however we can actually just try it out and see what
happens. We can then proceed to throw away the world if we don't like
it.

This is already a routine phenonmena with github pull requests. github
will merge our pull request into a hypothetical commit and at this
commit we can resolve a number of propositions at the new world. These
propositions might include linting, or unit tests or integration
tests. All of these are *constraints* which we want to hold on the
state of the repository *after* commit. We run them to see if it works
and then we can either have a *human* intervention (reviews or pushing
the merge button), or we can even merge automatically.

With structured data, this could prove a very powerful approach. We
can then easily externalise many difficult to encode constraints in
code which runs at the commit for instance, rather than try to do
everything in *the one true query language* (tm).

## A Different View

The decentralisation of data is simply a *fact* of locality in our
universe. It has become fashionable in enterprise over the last twenty
years to attempt to suppress this fact through a combination of very
impressive technologies and organisational structures in approaches
such as the data warehouse.

And these technologies are amazing, useful and the *illusion* of
locality is fantastic when it can be made to work. Tricks like CRDTs
and OT are super-cool.

But we're also missing multiple worlds of possibilities if we don't
pull back the curtains a bit and expose some more of the guts. The
beauty of git's model was in keeping all of our worlds visibile. We
can travel to the worlds, we can see the state transitions. This model
enabled a host of really amazing things only one of which is
versioning. It's real power came in enabling collaboration by exposing
the multiple worlds, their states and their transitions so that we
could work more directly with locality.
