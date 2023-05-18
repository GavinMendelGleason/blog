# Kripke Structures and Changing Knowledge

> It is in changing that we find purpose.
> -- Heraclitus

Our world changes, and our languages reflect this. At least our human
languages do. Some of us in the programming world have tried, in
vain, to eliminate state and its modification from our technical languages.

And the justification for this drive to eliminate state is not without
merit. Perhaps even great merit. State is incredibly difficult to
reason about. So many problems are caused by trying to cary state
around in computations when it would be better to be stateless. Many
difficult to discover bugs. Many race conditions while parallelising.

This has lead to a great number of stateless approaches including
message passing, logic programming, and the king of statelessness,
functional programming.

And part of this justification is that our logical languages, are
built around the unchanging and the immutable. Our type theories are
statements of invariance.

Yet it *is* possible to reason about state using logic, provided we
have a broad enough understanding of what constitutes a logic.

Saul Kripke invented Kripke structures as a way to think about how
logic can work over changing state.

## Imagine a world...


```
∘
w
```

We will call this world `w`.

At `w` we have a lot of things that could be true, provable or
whatever you like.

Maybe we have a bunch of *ground* facts, and then we have some
inference rules, and a bunch of things that are the result of running
these rules until we have formed all logical statements which are
true. Maybe instead we simply require that at a world we can
interrogate whether some predicate is true.

But whatever is the case about how we form our notions about what is
true at `w` (or how we find them to be true), certain logical
statements will be true at `w`. Perhaps something like: "Gavin is at
the store."

Now, lets say, that together with this world, and its logical
statements and their truth values, we have a relation. An
*accessibility relation*, which tells us what other worlds are
accessible from this world.


```
  R
∘ ⇒ ∘
w   w'
```

Now we have not only a way to perform *queries* against the world `w`,
but we have *update* which can bring us to a world `w'`!

We can think of these as actions, as imperative programmes, or
whatever, but for the purposes of our *model* we have a before state,
and an after state.


Of course in modelling there is quite a lot of freedom in what we want
to make internal to the relation `R` and what we want to make
explicit. We could for instance make `R` the product of a sub-routine
which updates the value `x` at `R` repeatedly, leading to a rake of
worlds `w', w'', w'''`, or we could instead decide to make that update
local and only witness the larger transition after this algorithm
completes.

The gralularity we choose and what is *internal* or external really
revolves around what we want to express about our system.

## Modal logic

Now what kinds of things can I express about our system?  Well, first,
let's talk about statements *at* a world.

```
w ⊢ Gavin is at home
w' ⊢ Gavin is at the store
```

However, now we can say things like, "There is a world in which Gavin
will be home". This means that in *some* accessible world, when all
paths are accounted for, there is a finite sequence of worlds before
we encounter the fact that `wn ⊢ Gavin is at home`

We write this as:

```
◇ Gavin is at home
```

With the `◇` as a modal logic operator which means *possibly*.

We can also say something like "Gavin is a human". This means that at
every accessible world, Gavin is a human. This is a type of
invariance.

```
□ Gavin is a human
```

## Modeling Programs

Such a logic is extremely expressive.
