# Type-tagging strings in Rust

![Colouring the Rusty Pipes](../assets/keeping_track_of_a_complex_of_interconnected.png)

Strings are pretty general data structures which can contain,
depending on the language, nearly arbitrary byte sequences. While this
generality makes them a very useful way of representing everything
from blocks of text to binary data, it can also be a hassle when you
want them to mean something *in particular*.

As such many languages have specific strings with encodings, or which
are guaranteed to have a known length etc.

However, sometimes you need a kind of string which is very
specific. In this case you need to *vet* a string to ensure that it
meets some very specific criteria. Examples abound, including checking
to see if a string is valid for insertion into a query to avoid SQL
injection attacks for instance.

One technique which has been used for decades (I used this trick in
SML in the early 2000s) is to tag your string with a type. Your
vetting function is the only one which is allowed to introduce the
type, and now you can safely ensure that everywhere the string is
used, it is only the kind of string which is vetted, but including the
vetting string type in the signature of the functions which use it.

The key idea: We leverage our type system to give us static guarantees
about what we are talking about and uncover misuses of names.

## The Problem: Three naming universes which must be distinct

In TerminusDB, we have a GraphQL endpoint which is auto-generated from
your schema definition. This is a no-code method of creating endpoints
which are extremely powerful and allow graph query.

However, GraphQL has a very narrow idea of what is an acceptable
name. TerminusDB by comparison, allows names to be anything which can
fit into a valid IRI. But most usage of these IRIs in TerminusDB is
actually via a shorter "prefixed" form which is easier to work with
than a full URL.

We have an automatic name conversion from our shorter form into
GraphQL, but this "sanitization" process, required to make a valid
GraphQL name, is necessarily lossy. Any attempt to create a non-lossy
conversion will result in ugly large expressions in post cases.

Of course having a manual conversion defined should also be possible
(although it is not yet implemented) but here again, we have to keep
track of which universe we are in.

The problem then is that we need a triangle with interconversion
everywhere:

```
        GraphQLName
      /            \
   ShortName — IriName
```

Ok, simple enough you say! Well it isn't rocket science to set up a
number of different bimaps in rust that will give you this
interconversion. Unfortunately though, it's very easy to just use the
wrong name, in the wrong context leading to catastrophic failure!

If you use an IRI when you need a GraphQLName, GraphQL will explode on
the unusual characters. If you try to use the GraphQLName where you
need an IRI, the database will fail to find the object you're looking
for.  We need to keep the universes seperated, and hence we want to
use the string vetting trick to tag a type on our string to ensure we
keep the three universes completely segregated.

## How this can work in Rust

We have one additional problem which is somewhat specific to rust (at
least at first glance) and that's that we want to be able to tag our
GraphQLName strings even if we haven't created ourselves. In rust this
is a *borrow*. This additional complication is due to the fact that we
are using Juniper, which represents GraphQL fields as a borrow of a
string `&str`.

Here is how we decided to represent our string tagging structs:

```rust
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Deserialize, Default, Hash)]
pub struct GraphQLName<'a>(pub Cow<'a, str>);
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Deserialize, Default, Hash)]
pub struct IriName(pub String);
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Deserialize, Default, Hash)]
#[repr(transparent)]
pub struct ShortName(pub String);
```

The first probably requires the most explanation. If we want to create
a GraphQLName based on either a `String` or a `&str` we need some way
to say we either have created a new thing, or are borrowing it from
somewhere else. This is what a `Cow` does for us. It's implemented as
follows:

```rust
pub enum Cow<'a, B: ?Sized + 'a>
where
    B: ToOwned,
{
    /// Borrowed data.
    Borrowed(&'a B),
    /// Owned data.
    Owned(<B as ToOwned>::Owned),
}
```

Basically it gives us two constructors, one for owned data and one for
borrowed data. With a few convenience trait implementations we can
kind of pretend this is string.

## Some convenience implementation

The string versions are pretty straightforward, but to use the Cow
approach effectively we need some helpers. One function which we
implement as a member on GraphQLName is able to create a static
version. The other just drops off the tagging of GraphQLName, which is
important for interfaces which are external and do not know about
GraphQLNames.

Of course, we always have to be careful about how we marshall *in* and
*out* but our problem has been confined to what is essentially a
perimeter security problem where we have to be very careful about how
things getting injected into the type and then how the type is
used. But this is much better than the original problem of semantic
spaghetti.

```rust
impl<'a> GraphQLName<'a> {
    pub fn as_static(&self) -> GraphQLName<'static> {
        match &self.0 {
            Cow::Borrowed(s) => GraphQLName(Cow::Owned(s.to_string())),
            Cow::Owned(s) => GraphQLName(Cow::Owned(s.clone())),
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}
```

We also want to have a couple of simple implementations for our
`ShortName` as this is the one which comes from TeriminusDB and from
which we need to construct our.

```rust
impl ShortName {
    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn sanitize(&self) -> GraphQLName<'static> {
        graphql_sanitize(&self.0)
    }
}
```

This implementation allows us not only to get the underlying `str` as
a borrow, but we can sanitize a `ShortName` and get a
`GraphQLName`. This is simply a renaming strategy defined with some
regexp replace which produces a sensible name which is also within the
viable GraphQL space of names (as defined by the regex: `[_a-zA-Z][_a-zA-Z0-9]*`).

Conversion between the various names is thereafter managed by
functions which use BiMaps which remember how we sanitized our
names. For instance, this fragment from `ClassDefinition`:

```rust
    pub graphql_to_iri: BiMap<GraphQLName<'static>, IriName>,
    pub graphql_to_short_name: BiMap<GraphQLName<'static>, ShortName>,
```

Now we can use a conversion function such as
`short_name_to_graphql_name` to get the kind of thing we want to be
talking about.

```rust
    pub fn short_name_to_graphql_name<'a>(&'a self, db_name: &ShortName) -> GraphQLName<'a> {
        self.short_to_graphql_name_opt(db_name)
            .unwrap_or_else(|| panic!("This class name {db_name} *should* exist"))
    }
```

When we need to drop back out of the definition at the boundary, we
use the `as_str` member function.  An example in the GraphQL code is
below on line 18 where we need to drop back from the name (as
GraphQLName) into a `&str` which is required by the Juniper interface.

```rust
    fn meta<'r>(
        info: &Self::TypeInfo,
        registry: &mut juniper::Registry<'r, DefaultScalarValue>,
    ) -> juniper::meta::MetaType<'r, DefaultScalarValue>
    where
        DefaultScalarValue: 'r,
    {
        let mut fields: Vec<_> = info
            .allframes
            .frames
            .iter()
            .filter_map(|(name, typedef)| {
                if let TypeDefinition::Class(c) = typedef {
                    let newinfo = TerminusTypeInfo {
                        class: name.as_static(),
                        allframes: info.allframes.clone(),
                    };
                    let field = registry.field::<Vec<TerminusType>>(name.as_str(), &newinfo);

                    Some(add_arguments(&newinfo, registry, field, c))
                } else {
                    None
                }
            })
            .collect();
...
```

There are a few places where we have to manually marshall a name in
from Juniper, but in changing to our type-tagging we caught at least
four naming bugs, which *could* work in some circumstances (in fact we
had tests which covered cases that magically worked) but don't work in
the general case.

It took about a full working day to convert the code, but given that
we found real bugs, all in all it was a worthwhile experiment!
