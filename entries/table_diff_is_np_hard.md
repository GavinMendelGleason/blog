# It turns out, Table Diff is NP-hard, but we tried it anyway

In programming, there are few things are more distressing than getting
stuck into a problem only to find it is NP-hard. So it was that I
stumbled head first into trying to solve the table-diff problem in
complete ignorance of what was in store.

The first diff algorithm I wrote seemed easy enough. I cribbed the
algorithm from something similar I had seen in a paper[^diff]. The
algorithm was obviously very non-deterministic / branching but I
didn't think too much of it. It wasn't until I tried it out on some
examples, using tables of 4 by 4 and 5 by 5 that I realised that the
naive approach might not be ok. My solution was taking almost a minute
comparing a 5 by 5 table. Going to 10 by 10 appeared to take the
heat-death of the universe. This kind of scaling behaviour meant that
a diff on a typical Excel file would be uselessly slow.

## First, What is a Diff?

A *diff* is a comparison utility which yields some sort of report,
patch or command structure about the structural differences between
two objects. The most common diff is of the textual line-based diffs
familiar from revision control systems such as git. These generally
work by finding the largest (in some sense) common sequence (of lines
perhaps) which is shared between two files, and then repeating the
procedure to find a minimal *patch* would could bring us from one
example to the other.

The most common line based diff is also a *contextual* diff. Meaning
that the patch which is constructed describes the surrounding context
in which the patch takes place, but does not explicitly describe the
entire file. This makes the patches more likely to *compose*. That is,
if I make a patch, and someone else makes a patch, they are likely to
apply in either order as long as we don't overlap in our changes if we
also don't also specify precisely what the rest of the file looks
like, or precisely what position in the file we want the change. The
first patch might shift everything down by a few lines for instance.

For example, given the two files:

```shell
$ cat <<EOF>a.txt
1
2
3
4
5
6
some context
more context
first
second
third
EOF
```

```shell
$ cat <<EOF>b.txt
1
2
3
4
5
6
some context
more context
first
third
fourth
EOF
```

`$ diff -u a.txt b.txt` yields:

```diff
--- a.txt	2022-02-14 23:56:58.307338707 +0100
+++ b.txt	2022-02-14 23:57:07.751245510 +0100
@@ -7,5 +7,5 @@
 some context
 more context
 first
-second
 third
+fourth
```

But a diff needn't be restricted merely to comparing strings. Many
data structures can be compared including, trees, lists, and indeed,
tables.

Tree diffs can be more or less complicated depending on if you want
shared structure and *moves* as well as just inserts and deletions,
but in the end they are pretty straight forward and exhibit reasonable
time complexity. Diffs of lists can be thought of as closely related
to the problem of diffs of lines of code. Of course coming up with
*deep* patches to elements of the lists, where each element is a tree
makes things a little more complicated but doesn't present a
significant barrier. And if there are lists within lists... well then
we're starting to get the (n-dimensional) table diff problem.

# What is a Table Diff?

A table diff generates a patch from two different matrices of
values. Tables of values are the types of things that you might find
in an Excel spreadsheet or a CSV.

```javascript
var x = [[1,2,3],
         [4,5,6],
         [7,8,9]]
var y = [[1,2,3],
         [4,5,6],
         [7,8,0]]
# Spot the difference?
```

Notably, this is *not* the same problem as a database table
difference. A database has fixed columns with fixed headers of a fixed
type - the order doesn't matter but the column names do. This problem
is equivalent to the tree diff with lists of leaves. We can basically
solve this the same way as we solve for strings.

```javascript
{ "column1" : [1,2,3],
  "column2" : ["a","b","c"] }
```

## Why is this hard?

The problem is that to compare the two matrices, we need to slide
every sub-window of every matrix over every other sub-window to find
where they maximally overlap. This is clearly going to be a bit time
consuming to say the least. But the *proof* that this is NP-hard comes
from the observation that solving this problem would solve another
problem, the [Graph Clique
Problem](https://en.wikipedia.org/wiki/Clique_problem).

Once I saw computations times spinning out of control, I started to do
a bit more research looking at the literature to solve the problem in
principle. To my amazement there was *very* little practical
literature that I could find written on the subject. One would think
that comparing two matrices would be a better studied problem!
Especially as it appears to be necessary to find a diff for something
as prosaic as Excel.

Fortunately there is a good paper on the so called Generalized
LCS[^glcs] (Longest Common Subsequence) problem. The paper notes that
since you can reduce a graph to an adjacency matrix, you can solve the
clique problem by solving the gernalized LCS over matrices. A clever
way of reducing the problem to another intractable problem. The paper
also shows that trees present no serious difficulties (at least
theoretically speaking).

## Perfect is the Enemy of Good

Ok, so now that we're well and truly screwed, what do we do? Well, the
problem we are having is one of finding a *maximal* answer. In
practice what we want is simply a *good* answer. It doesn't have to be
the absolute best answer because what we're trying to do is merely to
make the changes comprehensible.

That means we might be able to find a way out by getting solutions
that are sub-optimal but *good enough*. Hopefully we can use enough
tricks and heuristics to escape our conundrum.

Luckily there is a *lot* of literature on tricks for solving
NP-complete problems with heuristics. We couldn't find anything that
solved the precise problem but we found some hints and tricks that we
found helpful.

## Russian Dolls

The first trick was inspired by *Russian Doll Envelopes*. This is a
commonly used attack strategy in combinatorial optimization.  We want
to find maximal rectangles that exist in both matrix A and Matrix
B. We can choose an area size A, and then test all windows between A
and B. If we find a match, then we can try a bigger area. Using a
[binary search](https://en.wikipedia.org/wiki/Binary_search_algorithm)
we can find the largest overlap in a log-like way. Once we've found
the largest, we *know* that we can exclude this region, and since all
smaller areas are subsumed by this one, we can continue the search on
sub-problems.

## Moves Matter

The other trick to notice is that in a table diff, you really don't
want the same sort of contextual locking that you do in text. What
preceeds and what follows is probably not critical. Take for instance
an excel file that looks like this:

```
Name   | Birthdate | Position
Joe    | 10-12-91  | Jr. Engineer
Jill   | 05-20-82  | Sr. Engineer
```

If we reorder the Name and Birthdate columns, this shouldn't be
recognised as a *move* Similarly, if we sort the rows, we will want
these rows to be seen as *moves* rather than deletion and insertion of
new data.

This means we can compare the remaining windows without having to
worry too much about our neighbours.

## Choosing indices

The last trick is in choosing indices for our window comparisons. We
want to be able to keep choosing windows of regions which are not
*excluded* by maximal overlaps which have already been found. This is
a constraint satisfaction problem over inequality constraints in two
dimensions.

We used SWIPL's excellent clp(fd) library to solve this problem in a
relatively naive fashion, though we are still exploring a faster
solution with a custom constraint algorithm in rust.

## Escaping the Maze

Luckily, with a bit of elbow grease we were able to make the diff
algorithm practial for Excel spreadsheets which you might find in the
wild, rather than 10 by 10 toy problems.

Hubris sometimes has its rewards!

[^diff]: [Type-safe diff for families of
    datatypes](https://www.andres-loeh.de/GDiff.html), Eelco Lempsink,
    Sean Leather, Andres Löh
[^glcs]: [Generalized LCS](https://www.researchgate.net/publication/227255331_Generalized_LCS). Amir, Amihood & Hartman, Tzvika & Kapah, Oren & Shalom, Braha & Tsur, Dekel. (2007).
