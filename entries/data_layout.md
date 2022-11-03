# TerminusDB Internals part 3: Sorting Every Sort of Thing

Some of the the original experiments with TerminusDB were in postgres,
where we built a table of IRIs and ids, and then created a
multi-indexed table of triples. We then compared the speed of this to
a library called HDT which created a compact representation of graphs,
and found HDT to be extremely fast for large RDF databases (Think TTL
files on the order of 100GB).

This got us thinking seriously about succinct data structures, and so
TerminusDB has used the ideas in HDT as a starting point.

One of the choices made by HDT is the [front coded
dictionary](https://en.wikipedia.org/wiki/Incremental_encoding). This
tends to work very well for IRIs, since we tend to share addresses as
prefixes, leading to substantial compression and reasonable retrieval
speed.

The dictionary reliese on lexical sorting of data, as we want to
branch at points which share prefixes. So sorting lexically helps us
to maximally share prefixes.

Lexical ordering also allows us to start with a prefix, and iterate
over everything which shares it, or to perform fast range queries,
simply by finding the beginning point, and iterating until we are
at the terminus of the range.

So we get:

* Compression
* Log like access
* Range queries

But not everything is naturally designed to be stored lexically. Take
the classic example of the directory in linux:


```shell
gavin@titan:~/tmp/sort$ touch 2
gavin@titan:~/tmp/sort$ touch 11
gavin@titan:~/tmp/sort$ touch 10
gavin@titan:~/tmp/sort$ touch 100
gavin@titan:~/tmp/sort$ touch 101
gavin@titan:~/tmp/sort$ touch 110
gavin@titan:~/tmp/sort$ ls -la
total 8
drwxrwxr-x  2 gavin gavin 4096 Okt 31 11:59 .
drwxrwxr-x 14 gavin gavin 4096 Okt 31 11:59 ..
-rw-rw-r--  1 gavin gavin    0 Okt 31 11:59 1
-rw-rw-r--  1 gavin gavin    0 Okt 31 11:59 10
-rw-rw-r--  1 gavin gavin    0 Okt 31 11:59 100
-rw-rw-r--  1 gavin gavin    0 Okt 31 11:59 101
-rw-rw-r--  1 gavin gavin    0 Okt 31 11:59 11
-rw-rw-r--  1 gavin gavin    0 Okt 31 11:59 110
-rw-rw-r--  1 gavin gavin    0 Okt 31 11:59 2
```

In this world 11 is less than 101, and 2 is greater than 110. Not what
we typically want when we are sorting numbers.

## Lexical Everything

But as it turns out, numbers can also be sorted lexically, provided we
store them in a clever way. These lexical ordering tricks can give us
id<->data conversion using dictionaries, which allows for compression,
prefix queries and range queries.

### Integers

So how do we get 100 to be larger than 2? If we have *fixed* size
integers, such as Int32, the answer is relatively simple. We break
Int32 into 4 bytes written out in [big
endian](https://en.wikipedia.org/wiki/Endianness). We're almost done
save one complication. In most representations, we keep around a
*sign* bit on integers, generally stored in the most significant
position, which is 1 if the number is negative, and 0 if it is
positive.

This is terrible, since all negative numbers are now larger than
positive numbers. Further, integers are generally stored in a [two's
complement](https://en.wikipedia.org/wiki/Two%27s_complement), meaning
that we flip every bit of a negative number. This is actually a *good*
thing. Because it means that smaller numbers are bigger, and bigger
numbers are smaller. Which is exactly how we expect negative numbers
to sort! That is, -10 should be smaller than -1.

```rust
-1 = 0bffff_fffe
```

To fix the sign problem is simple. We just flip the sign bit and we
are done! We now have lexically sortable integers.

### Floats

IEEE Floating point numbers are also surprisingly simple to sort
lexically. We have the same trick, requiring a sign flip, but in the
case of negative numbers, we actually have to put them in the twos
complement representation, as floating point can't avail of the same
twos complement tricks used in integer arithmetic, so this is computed
externally.

This is all there is to it in rust (using the `bytes_order` library to
ensure we get a big endian representation).

```rust
const F32_SIGN_MASK: u32 = 0x8000_0000;
const F32_COMPLEMENT: u32 = 0xffff_ffff;
fn float32_to_vec(f: &f32) -> Vec<u8> {
    let g: f32 = if f.to_bits() & F32_SIGN_MASK > 0 {
        f32::from_bits(f.to_bits() ^ F32_COMPLEMENT)
    } else {
        f32::from_bits(f.to_bits() ^ F32_SIGN_MASK)
    };
    let mut wtr = Vec::with_capacity(4);
    wtr.write_f32::<BigEndian>(g).unwrap();
    wtr
}
```

Notice, flipping all of the bits is just an
[xor](https://en.wikipedia.org/wiki/Exclusive_or) with a complement
mask which has every bit set.

Perhaps surprisingly, this trick also works for NaN and Negative and
Positive Infinity!

### BigInts

But what about big integers? If the size is not fixed, what are we to
do? Well, we could find the largest number and store everything in the
number of bits required by this largest number, and use the
representation above. However, this threatens to use up a lot of space.

Instead, we can simply *prefix* integers with their size. Conceptually
we can rewrite our directory files from above as:

```shell
gavin@titan:~/$ python
>>> x = ["0_1", "2_10","3_100","3_101","2_11","0_2"]
>>> x.sort()
>>> x
['0_1', '0_2', '2_10', '2_11', '3_100', '3_101']
```

Presto! It works!

But what about negative numbers? Well, we can perform the same sorts
of trick with complements. Let's do a complement in base 10 to see how
it works.

First, let's add a few more numbers to our list. How about -1, -2, and
-10. Now, we can represent a negative with an `-` character which is
less than every number in ascii. Then we can take our size, and
complement it with 9, so that 9 is 0, and 0 is 9, and every other
digit is in between.

Ok, so -1 becomes `-9_9`. -2 is `-9_8`. And -10 is `-8_89`.


```shell
gavin@titan:~/$ python
>>> x = ["0_1", "2_10","3_100","3_101","2_11","0_2", "-9_9", "-9_8", "-8_89"]
>>> x.sort()
>>> x
['-8_89', '-9_8', '-9_9', '0_1', '0_2', '2_10', '2_11', '3_100', '3_101']
```

Great! We have an encoding that puts -10 on the bottom, and -1 on the
top of the negatives.

Of course, if you're paying close attention, you'll see that we need a
way to represent sizes that can go bigger than 9. We need a lexically
sortable kind of size signifier. There are lots of ways to do this,
with the simplest being unary. You simply take the size and represent
it with a number of 1s and a self-delimiting zero. So the size 3
becomes `1110`.  This is pretty big, and a bit awkward, plus it
doesn't respect byte alignment, but is manageable in certain settings.

In TerminusDB we instead use an encoding which has a *continuation
bit*. That is, we represent numbers up to 128 with the bits of the
number in binary. So 3 would be `0b000_0011`. We then stick a bit at
the top which is *zero* if the number is less than 128 and *one* if
we're only representing the top 7 bits of our number, and our number
is greater than 128 in which case we need another byte. Now, our
encoded 3 becomes the entire byte: `[0b0000_0011]`. One can easily see
that anything greater than 128 will already compare as larger than
anything less than 128 because it will have its most significant bit
set. 129 becomes the two bytes: `[0b1000_0001, 0b0000_0001]`.

This kind of trick is called
[variable-byte](https://en.wikipedia.org/wiki/Variable-length_quantity)
encoding, and sorts the orders first, and the numbers inside of that
order.

### Decimal

TerminusDB implements the XSD data types. And one of these data types
is the rather unusual `xsd:decimal` which codes arbitrary precision
decimal numbers. It's unsual because most database do not store
aribtrary precision floating points, and if they do, they generally do
so in binary. While often times people *want* information recorded in
the base-10 they are familiar with, a lot of our computing
infrastructure makes this somewhat awkward.

As it turns out, you can *also* store these lexically, provided we do
a bit of monkey-business.

In TerminusDB we store these with a pair of elements concatenated. The
first is a bignum, which stores everything before the full stop. The
second part is a v-byte style binary-coded decimal, which packs two
decimal characters per byte. This represents *no* decimal as the
lowest element, and a single digit decimal interleaved between
two-digit decimals.

| decimal | encoding |
|---------|----------|
|   none  |    0     |
|   0     |    1     |
|   00    |    2     |
|   01    |    3     |
|   02    |    4     |
|   ...   |   ...    |
|   1     |    12    |
|   10    |    13    |
|   ...   |   ...    |
|   9     |   100    |
|   90    |   101    |
|   ...   |   ...    |
|   99    |   111    |

We leave the *last* bit as a continuation bit for our v-byte encoding,
as we need to compare as larger, only if the rest of the byte is the
same.

Schematically:

```diagram

   BCD
    |     continuation bit
    |     |
| xxxxxxx c | xxxxxxx c | ...
```

This representation also allows us to keep significant digits, for
instance `0.0` will be encoded differently from `0` and from `0.00`,
while retaining appropriate lexical sorting. This is important in
scientific applications where significance should be recorded.

### Dates

`xsd:dateTime` is a format which is based on ISO 8660, and is actually
already *mostly* lexical. However it is broken in that the first
element can be negative, can be larger than 4 digits, and can have a
time-zone offset, and an arbitrary precision float for sub-second
portions of the date.

Further, the format is a string, which is far too large to efficienty represent
the data contained.

In TerminusDB we deal with this simply by converting the number into a
decimal encoding of the number of seconds since 1970 with an arbitrary
precision. This can encode the femto-seconds of a laser pulse to the
point at which the universe started in a format that is range
querable, without breaking the bank in terms of size!

Does any other database do this?

### Other types

We've also played around with some other types, including tuples and
even dictionaries, all of which support a lexical ordering and range
queries. We haven't implemented them as we're not sure about the
use-cases, but it's certainly interesting.

### Even Smaller

Of course it's possible to get smaller and faster on all of these
datatypes with appropriate datastructures, and we're keen on plumbing
the depths of tiny as TerminusDB matures. If you've a favourite
encoding approach which is also fast and supports range queries, or
can think of other interesting data types which can be supported, give
us a shout!
