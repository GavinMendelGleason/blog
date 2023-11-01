# AI Entity Resolution: Bridging Records Across Human Languages

![An AI Matching Records to perform Entity Resolution](../assets/A_neon_3D_network_of_interconnected_database.png)

Nearly everyone is familiar with having the same person twice in their
phone contacts list. Somehow you get a record of Joe Bloggs with just
his e-mail, and likewise one with just his phone number.

Wouldn't it be nice if there were some way to decide if two records
were the same record? Or at the very least that they were close.

[Entity resolution](https://en.wikipedia.org/wiki/Record_linkage)
(also sometimes called record linkage, data matching and data
linkage), is the process by which we take two records and decided
whether they should be the same record.

The problem is by no means new. Algorithms for entity resolution have
been in place since the 1960s. But the ubiquity of
[LLMs](https://en.wikipedia.org/wiki/Large_language_model) (Large
Language Models) has made it possible to solve the problem with AI.

And the AI solution has some huge advantages. Rather than defining a
large number of rules which help to normalize fields for comparison
(Turning Mr. into Mister, St. Into Street, etc.) and then subsequently
using some sort of distance measure (such as
[Levinshtein](https://en.wikipedia.org/wiki/Levenshtein_distance)) to
overcome spelling mistakes and the like, and then finally assembling
many pieces of data into some aggregate using statistical models, we
can take a short-cut.

We can leverage the full power of LLMs to provide us with a
semantically meaningful embedding in a high-dimensional vector space
in which to make our comparison.

This approach both increases performance of matches, reduces
programmer tuning for record structure and makes it easy to perform
incremental updates to the database. This last bit is very hard for
many matching strategies which scale poorly as new records are
added.

And amazingly, as an added magic benefit AI along the way, we also get
language agnosticism for free! We can actually compare records in
German and English for instance, and get candidates for merger
automatically.

Let's see how this works.

## Preliminaries

To follow along with this tutorial, we will need to install a bit of
software:

First install a [TerminusDB
server](https://github.com/terminusdb/terminusdb) acording to the
directions here.

Then install [tdb-cli](https://github.com/terminusdb-labs/tdb-cli) so
we can easily perform operations from the command line against the server.

You will also need a command line web client, such as
[curl](https://curl.se/).

## Defining an embedding for Creative Works

To get an idea of how the approach works, we are going to start on
three documents which we produce by hand. In a later blog we'll see
candidates over a more extensive corpus (and how to find thresholds
for merger).

In TerminusDB we start with a schema definition. We are going to be
comparing symphonies so we will need a number of optional fields which
are usually present in these types of works.

```json
{ "@type" : "Class",
  "@id" : "Work",
  "key": 	{ "@type" : "Optional", "@class" : "xsd:string" },
  "opus" : { "@type" : "Optional", "@class" : "xsd:string" },
  "period" : { "@type" : "Optional", "@class" : "xsd:string" },
  "text" : { "@type" : "Optional", "@class" : "xsd:string" },
  "language" : "xsd:language",
  "dedication" : { "@type" : "Optional", "@class" : "xsd:string" },
  "duration" : { "@type" : "Optional", "@class" : "xsd:string" },
  "date" : { "@type" : "Optional", "@class" : "xsd:string" },
  "composed" : { "@type" : "Optional", "@class" : "xsd:string" },
  "movements" : { "@type" : "Optional", "@class" : "xsd:string" },
  "composer" : { "@type" : "Optional", "@class" : "xsd:string" }
}
```

We can save this as the file `creative-work-schema.json`. To load this
schema we will need to create a database and then add this schema document.

First, we create the database:

```shell
tdb-cli db create admin/works
```

Next we insert the schema:

```shell
tdb-cli doc insert -g schema admin/works < creative-work-schema.json
```

Now we need some documents which meet the schema definition. We define
a few by hand, but one can imagine getting such data from many
different sources, csv, or wikidata or the like. We are going to use
only the following documents to get an idea of distances between them:

```json
[{ "@type" : "Work",
   "@id" : "Work/Ode_to_Joy",
   "composer" : "Ludwig van Beethoven",
   "key": 	"D minor",
   "opus" : "125",
   "period" : "Classical-Romantic (transitional)",
   "text" : "Friedrich Schiller's Ode to Joy",
   "language" : "de",
   "composed" : "1822-1824",
   "dedication" : "King Frederick William III of Prussia",
   "duration" : "about 70 minutes",
   "movements" : "Four",
   "date" : "7 May 1824"
 },
 { "@type" : "Work",
   "@id" : "Work/Ode_an_die_Freude",
   "composer" : "Ludwig van Beethoven",
   "key" : "d-Moll",
   "opus": "125",
   "period": "Klassik-Romantik (Übergangszeit)",
   "text": "Friedrich Schillers Ode an die Freude",
   "language": "de",
   "composed": "1822-1824",
   "dedication": "König Friedrich Wilhelm III. von Preußen",
   "duration": "etwa 70 Minuten",
   "movements": "4",
   "date": "7. Mai 1824"
 },
 { "@type" : "Work",
   "@id" : "Work/Symphony_No_7_in_A_major",
   "composer" : "Ludwig van Beethoven",
   "key" : "A major",
   "opus" : "92",
   "composed" : "1811–1812",
   "language" : "de",
   "dedication"	: "Count Moritz von Fries",
   "movements" : "Four"
 }
]
```

We will save this document as `creative-work.json` and then we can
load into the datbase with the cli as follows:

```shell
tdb-cli doc insert admin/works < creative-work.json
```

As you'll note here, we have the same record twice. However the 9th
symphony is written in both English and German, and the 7th is only in
English.

## Creating Embeddings

To create the embeddings we are going to have to modify our schema to
include two elements: A graphql query and a handlebars template.

You can easily play around with what graphql queries are possible by
starting up the GraphQL interface from `tdb-cli` with the command:

```shell
tdb-cli graphql serve admin/works -o
```

I did this and created the following simple query:

```graphql
query($id: ID){
  Work(id: $id){
    composed
    composer
    date
    dedication
    duration
    key
    language
    movements
    opus
    period
    text
  }
}
```

When creating this query, you will not want to specify the `$id` such
that you can play around to get the kind of query document you
want. Remember, it can follow edges and get information from
neighbours if this is likely to help your embedding!

The `$id` part is important and has to be added to your query, since
we are going to look up each document in turn through the indexing
interface. It constraints the query result to be precisely the id we are
interested in.

Next we need to take this query result and turn it into a high quality
embedding. We do this with a [handlebars
template](https://handlebarsjs.com/). This template should contain
semantic information about the fields of the object you intend to
embed and what they mean.

```handlebars
{{#if composer}}The piece was composed by {{composer}}. {{/if}}
{{#if opus}}It is opus number {{opus}}. {{/if}}
{{#if composed}}The piece was composed during {{composed}}. {{/if}}
{{#if date}}The piece is dated to {{date}}. {{/if}}
{{#if dedication}}The piece was dedicated to {{dedication}}. {{/if}}
{{#if duration}}The piece is {{duration}} long. {{/if}}
{{#if key}}The piece is in the key of {{key}}. {{/if}}
{{#if movements}}The piece has {{movements}} movements. {{/if}}
{{#if period}}The piece was composed during the {{period}} period. {{/if}}
{{#if text}}The piece is associated with the text {{text}}. {{/if}}
```

As we have a lot of fields which are optional, we try to make sure we
don't write any contextual information if the data point it is missing
from the source.

Once we have created these, we will update our schema document to
contain the information about how to create an embedding for this
object.

```javascript
{ "@type" : "Class",
  "@id" : "Work",
  "@metadata" : {
    "embedding" : {
      "query" : "
query($id: ID){
  Work(id: $id){
    composed
    composer
    date
    dedication
    duration
    key
    language
    movements
    opus
    period
    text
  }
}",
      "template" : "
{{#if composer}}The piece was composed by {{composer}}. {{/if}}
{{#if opus}}It is opus number {{opus}}. {{/if}}
{{#if composed}}The piece was composed during {{composed}}. {{/if}}
{{#if date}}The piece is dated to {{date}}. {{/if}}
{{#if dedication}}The piece was dedicated to {{dedication}}. {{/if}}
{{#if duration}}The piece is {{duration}} long. {{/if}}
{{#if key}}The piece is in the key of {{key}}. {{/if}}
{{#if movements}}The piece has {{movements}} movements. {{/if}}
{{#if period}}The piece was composed during the {{period}} period. {{/if}}
{{#if text}}The piece is associated with the text {{text}}. {{/if}}
"
    }
  },
  "key": 	{ "@type" : "Optional", "@class" : "xsd:string" },
  "opus" : { "@type" : "Optional", "@class" : "xsd:string" },
  "period" : { "@type" : "Optional", "@class" : "xsd:string" },
  "text" : { "@type" : "Optional", "@class" : "xsd:string" },
  "language" : "xsd:language",
  "dedication" : { "@type" : "Optional", "@class" : "xsd:string" },
  "duration" : { "@type" : "Optional", "@class" : "xsd:string" },
  "date" : { "@type" : "Optional", "@class" : "xsd:string" },
  "composed" : { "@type" : "Optional", "@class" : "xsd:string" },
  "movements" : { "@type" : "Optional", "@class" : "xsd:string" },
  "composer" : { "@type" : "Optional", "@class" : "xsd:string" }
}
```

Again, save this as `creative-work-schema.json` and then you can
replace the original schema document with:

```shell
tdb-cli doc insert -g schema admin/works < creative-work-schema.json
```

With this new schema in place, we can index our embeddings

## Indexing the Embeddings with VectorLink and OpenAI

Now that we've populated our database we need to index our embeddings
with [VectorLink](https://github.com/terminusdb-labs/vectorlink) and
OpenAI. We will need the most recent commit id, since when indexing we
can't just have a branch name, we need to know precisely what commit
we are referring to.

```shell
export COMMIT_ID=`curl 127.0.0.1:6363/api/log/admin/works?count=1 -uadmin:root | jq '.[] | .identifier' | sed 's/"//g'`
```

This will extra the last commit id from the history log. In my case it is:

```shell
$ echo $COMMIT_ID
00c8dr7oyv4nfld947a5g7vk9ci9r9u
```

Once you have the commit id, we can fire off the indexer. First
though, we need an OpenAI API key so we can get back vectors for our
embedding documents. After you have obtained an API key from OpenAI,
we can use it in our headers when talking to VectorLink:

```shell
export VECTOR_LINK_EMBEDDING_API_KEY="..."
```

Now we can ask vector link to index our data as follows:

```shell
export TASK_ID=`curl -H "VECTORLINK_EMBEDDING_API_KEY: $VECTOR_LINK_EMBEDDING_API_KEY" 'localhost:8080/index?commit=$COMMIT_ID&domain=admin/works'`
```

This command will give you back a task id. We can use that to check
the status of indexing. Since we only have three documents, this
should be nearly instantaneous and isn't very useful (until you get
thousands or millions of documents). You can check what the status is
with:

```shell
curl -H "VECTORLINK_EMBEDDING_API_KEY: $VECTOR_LINK_EMBEDDING_API_KEY" 'localhost:8080/check?task_id=$TASK_ID'
```

It should say:

```json
{"indexed_documents":3,"status":"Complete"}
```

## Cross-Language Entity Resolution

Now all of our document embeddings have been vectorised we can ask
questions about them. One of the kinds of questions we can ask is what
is in the neighbourhood of a given vector. Let's look up the
similarity of records to the record `Work/Ode_to_Joy`.

```shell
curl -H "VECTORLINK_EMBEDDING_API_KEY: $VECTOR_LINK_EMBEDDING_API_KEY" 'localhost:8080/similar?commit=$COMMIT_ID&domain=admin/works&id=terminusdb:///data/Work/Ode_to_Joy'
```

For this query we get back the following response:

```json
[{"id":"terminusdb:///data/Work/Ode_to_Joy","distance":1.7881393e-7},
 {"id":"terminusdb:///data/Work/Ode_an_die_Freude","distance":0.011980891},
 {"id":"terminusdb:///data/Work/Symphony_No_7_in_A_major","distance":0.032711923}]
```

Unsurprisingly `Work/Ode_to_Joy` is very close to itself (though not
exactly since floating point arithmetic is silly). However we also see
that `Work/Ode_an_die_Freude` is also extremely close! And it is
nearly 3 times closer than another record of Beethoven's works,
despite both similar records being in a different language! This
outcome would be extremely hard to imagine given that we were using
traditional entity resolution tools.

## Next Steps

This is only suggestive, given that it's only three records. Further
our exploration leaves out two important problems. On large entity
resolution problems we will need automatic record merger. This is
because humans simply can't review millions of potential candidates in
most cases. This means we have to establish some sort of threshold for
when we can be sure that two records are the same.

Secondly, in practice we will also want to present some candidates for
merger to humans if we can't decided automatically. This means we have
to establish another, threshold, relatively close to the first which
will help us to determine what records might be candidates.

And in both cases, when we merge, we will have to decide how to
represent the merged records in a way that we can understand how they
came to be merged. But that's all for another blog... Hopefully you
have enough information to have your own fun playing with TerminusDB
and VectorLink for entity resolution!
