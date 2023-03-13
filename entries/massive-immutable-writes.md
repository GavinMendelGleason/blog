# Massive Immutable Writes

Imagine a scenario in which we get a feed of time-stamped data. Every
unit of information is guaranteed to be new, so to first order (there
maybe fixups required later) we don't have to worry about older
information being duplicated.

Further, we want to have multiple writers, on the order of a 1000 of
them.

How can we perform realtime analytics over such a setup?

In an immutable setup, each write.
