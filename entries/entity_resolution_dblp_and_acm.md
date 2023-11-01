# DBLP and ACM publication record matching
## AI entity resolution using TerminusDB, OpenAI and VectorLink

The DBPL / ACM publication record matching benchmark was constructed
in order to have a good test-set for exploring the quality of
automatic record matching algorithms.

We are going to explore matching results on this dataset using an
unusual, but very simple and straightforward approach which leverages
OpenAI's [LLM](https://en.wikipedia.org/wiki/Large_language_model)
(Large Language Model), requires very little tuning or fiddling and
which you can easily adapt to your own data problems.

## Preliminaries

See [Part1](entity_resolution.md) for a description on what software
to install to use this tutorial.

## Ingesting the Data

To ingest the data from the csv's that are distributed with the test
set, we can write a little python helper and use the
[tdb-cli](https://github.com/terminusdb-labs/tdb-cli) which can work
with local or cloud TerminusDB databases.

First lets create a schema:

```json
[
  { "@type" : "@context",
    "@base" : "iri:///dblp-acm/i/",
    "@schema" : "iri:///dblp-acm#"
  },
  { "@type" : "Class",
    "@id" : "Publication",
    "@key" : { "@type" : "Lexical",
               "@fields" : ["id"] },
    "@metadata" : { "embedding" : { "query" : "query($id: ID){ Publication(id : $id) { title, authors, venue, year } }",
                                    "template" : "The title of the paper is {{title}}. The authors are: {{authors}}. The venue for publication was: {{venue}}. The year of publication was {{year}}."
                                  }
                  },
    "id" : "xsd:string",
    "title" : "xsd:string",
    "authors" : "xsd:string",
    "venue" : "xsd:string",
    "year" : "xsd:gYear",
    "source" : "xsd:string"
  }
]
```

This schema has a number of fields, all of which are required. The
final field `source` will be used to remind us the source of the
record (ACM versus DBLP2).

In addition we've taken the liberty of creating a query and template
for the embedding of our publications. To see more about how these are
constructed look at [Part1: AI Entity Resolution: Bridging Records
Across Human Languages](../entries/entity_resolution.md).

Once we've constructed the schema we can create the documents for
ingestion to TerminusDB:

```python
import csv
import json

with open("all_records.json", 'w') as output:
    with open("ACM.csv", 'r') as acm:
        dictreader = csv.DictReader(acm)
        for d in dictreader:
            d['source'] = "ACM.csv"
            output.write(json.dumps(d))
            output.write("\n")
    with open("DBLP2.csv", 'r') as dblp:
        dictreader = csv.DictReader(dblp)
        for d in dictreader:
            d['source'] = "DBLP2.csv"
            output.write(json.dumps(d))
            output.write("\n")
```

We can save this as `ingest.py` and then type:

```shell
python ingest.py
```

This generates a file called `all_records.json` which contains every
record we intend to add in a [json-lines](https://jsonlines.org/) file.

Now we fire off terminusdb, first creating our database and then
ingesting our schema and data.

```shell
tdb-cli db create admin/dblp_acm
tdb-cli doc insert -g schema -f admin/dblp_acm < dblp-acm.json
tdb-cli doc insert admin/dblp_acm < all_records.json
```

## Indexing the database

First we need the last commit of the database:

```shell
export COMMIT_ID=`curl 127.0.0.1:6363/api/log/admin/dblp_acm?count=1 -uadmin:root | jq -r '.[] | .identifier'`
```

We obtained this from the history log and saved it into the
`$COMMIT_ID` environment variable.

We also need to make sure that we have put our OpenAI key in the
environment:

```shell
export VECTORLINK_EMBEDDING_API_KEY="..."
```

Now we can fire off the indexer:

```shell
export TASK_ID=`curl -H "VECTORLINK_EMBEDDING_API_KEY: $VECTORLINK_EMBEDDING_API_KEY" "localhost:8080/index?commit=$COMMIT_ID&domain=admin/dblp_acm"`
```

We can check on the progress of this by looking at the task id that
was returned.

```shell
curl -H "VECTORLINK_EMBEDDING_API_KEY: $VECTORLINK_EMBEDDING_API_KEY" "localhost:8080/check?task_id=$TASK_ID"
```

Eventually it will say:

```json
{"indexed_documents":4910,"status":"Complete"}
```

## Finding Candidates

We can now go through the list and look at candidates for merger. This
process can also be done incrementally as new objects are added, but
we'll have to repeated it `n` times to start, for each element in our
database.

Let's look at the results of some of our documents. First, we can look
up `iri:///dblp-acm/i/Publication/174639` with terminusdb to see what
we're talking about:

```shell
tdb-cli doc get admin/dblp_acm --id=iri:///dblp-acm/i/Publication/174639 | jq
```

The response should be:

```json
{
  "@id": "Publication/174639",
  "@type": "Publication",
  "authors": "Kenneth Salem, H&#233;ctor Garc&#237;a-Molina, Jeannie Shands",
  "id": "174639",
  "source": "ACM.csv",
  "title": "Altruistic locking",
  "venue": "ACM Transactions on Database Systems (TODS) ",
  "year": "1994"
}
```

Ok, so what do we have which might be similar? Let's ask VectorLink:

```shell
curl -H "VECTORLINK_EMBEDDING_API_KEY: $VECTORLINK_EMBEDDING_API_KEY" "localhost:8080/similar?commit=$COMMIT_ID&domain=admin/dblp_acm&id=iri:///dblp-acm/i/Publication/174639" | jq
```

To which we get the response:

```json
[
  {
    "id": "iri:///dblp-acm/i/Publication/174639",
    "distance": 0
  },
  {
    "id": "iri:///dblp-acm/i/Publication/journals%2Ftods%2FSalemGS94",
    "distance": 0.009044021
  },
  {
    "id": "iri:///dblp-acm/i/Publication/journals%2Fvldb%2FSinghalS97",
    "distance": 0.053882957
  }
]
```

This first result looks extremely promising, and the second looks
dubious having a distance almost 6 times as large.

What is the first result?

```shell
tdb-cli doc get admin/dblp_acm --id=Publication/journals%2Ftods%2FSalemGS94 | jq
```

And we get:

```json
{
  "@id": "Publication/journals%2Ftods%2FSalemGS94",
  "@type": "Publication",
  "authors": "Jeannie Shands, Kenneth Salem, Hector Garcia-Molina",
  "id": "journals/tods/SalemGS94",
  "source": "DBLP2.csv",
  "title": "Altruistic Locking",
  "venue": "ACM Trans. Database Syst.",
  "year": "1994"
}
```

This is looking very promising indeed! This record is *quite*
different due to the use of html entities describing inflections in
one record, and folding into standard latin character set in the
other, the use of acronyms in the venue in one, and none in the
other. But perhaps most importantly, this is not cherry-picked. This
was literally the first record that went in to our vector indexer (at
id zero) and we have just found its match.

We now have a suggestion that a threshold might be somewhere in the
vacinity of a distance of `0.01`.

Let's just check out the next record to get an idea of how well we are
doing, and then we can run over the complete datasets to create a
candidates list.

```
tdb-cli doc get admin/dblp_acm --id=iri:///dblp-acm/i/Publication/174641 | jq
```

And we get:

```json
{
  "@id": "Publication/174641",
  "@type": "Publication",
  "authors": "Patrick Tendick, Norman Matloff",
  "id": "174641",
  "source": "ACM.csv",
  "title": "A modified random perturbation method for database security",
  "venue": "ACM Transactions on Database Systems (TODS) ",
  "year": "1994"
}
```

Running our similarity query:

```
curl -H "VECTORLINK_EMBEDDING_API_KEY: $VECTORLINK_EMBEDDING_API_KEY" "localhost:8080/similar?commit=$COMMIT_ID&domain=admin/dblp_acm&id=iri:///dblp-acm/i/Publication/174641&count=3" | jq
```

We get

```json
[
  {
    "id": "iri:///dblp-acm/i/Publication/174641",
    "distance": 0
  },
  {
    "id": "iri:///dblp-acm/i/Publication/journals%2Ftods%2FTendickM94",
    "distance": 0.008429408
  },
  {
    "id": "iri:///dblp-acm/i/Publication/331986",
    "distance": 0.020701468
  }
]
```

Going with our hypothesis of threshold we appear to have found a match:

```shell
tdb-cli doc get admin/dblp_acm --id=iri:///dblp-acm/i/Publication/journals%2Ftods%2FTendickM94 | jq
```

And what does this record look like?

```json
{
  "@id": "Publication/journals%2Ftods%2FTendickM94",
  "@type": "Publication",
  "authors": "Norman S. Matloff, Patrick Tendick",
  "id": "journals/tods/TendickM94",
  "source": "DBLP2.csv",
  "title": "A Modified Random Perturbation Method for Database Security",
  "venue": "ACM Trans. Database Syst.",
  "year": "1994"
}
```

Bingo! We're about ready to run with our hypothesis - we can of course
choose a tight bound to start with, maybe not `0.01` but actually
`0.0091` as this is liable to get us only positives.  We can think
about how to relax it later.

## Creating the Automated Match Set

Ok, so lets go with `0.0091` and build up all possible matches. To
make this easier we'll create a small python programme which iterates
over all of the ids.

Our vector database allows us to find candidates with the following
command:

```shell
curl -H "VECTORLINK_EMBEDDING_API_KEY: $VECTORLINK_EMBEDDING_API_KEY" "localhost:8080/duplicates?commit=$COMMIT_ID&domain=admin/dblp_acm&threshold=0.0091" | jq > duplicates.json
```

Luckily, since this is a benchmark, we can check these duplicates
against the right answer.  Let's write a little checker and see what
our precision and recall actually is.

First, lets remember the original ids, and how they relate to our
TerminusDB ids so we can look them up later:

```shell
tdb-cli doc get admin/dblp_acm -l | jq 'map([."@id", .id ])' > map.json
```

Now it's just a question of checking against our correct answers. We
can run this program and it will tell us our precision and recall.

```python
import csv
import json

def is_acm(i):
    try:
        x = int(i)
        return True
    except Exception as e:
        return False

# Id map
id_map = {}
id_map_file = "map.json"
for [terminus_id, original_id] in json.load(open(id_map_file,'r')):
    id_map[f"iri:///dblp-acm/i/{terminus_id}"] = original_id

# Correct answers
matches = {} # Match with ACM as key
matches_file = "DBLP-ACM_match.csv"
with open(matches_file, 'r') as f:
    r = csv.reader(f)
    for (dblp,acm) in r:
        matches[acm] = dblp

duplicates_map = {}
duplicates_file = "duplicates.json"
duplicates = json.load(open(duplicates_file,'r'))
for [id1,id2] in duplicates:
    original1 = id_map[id1]
    original2 = id_map[id2]
    if is_acm(original1) and not is_acm(original2):
        duplicates_map[original1] = original2
    elif is_acm(original2) and not is_acm(original1):
        duplicates_map[original2] = original1

# Calculate precision
total = len(matches)
total_retrieved = len(duplicates_map)
relevant = 0
for acm_key in duplicates_map:
    if duplicates_map[acm_key] == matches[acm_key]:
        relevant+=1
precision = relevant / total_retrieved
print(f"relevant: {relevant}")
print(f"total retrieved: {total_retrieved}")
print(f"total relevant: {total}")
print(f"Precision: {precision}")

# Calculate precision
recall = relevant / total
print(f"Recall: {recall}")
```

So what then do we get for our results?

```text
relevant: 1795
total retrieved: 1802
total relevant: 2224
Precision: 0.9961154273029966
Recall: 0.8071043165467626
```

For a back-of the napkin guess based on two examples, 99.6% ain't
bad. We might want to tighten our bound a little if we're dealing with
a large corpus.

Our recall is a bit lower to be sure, but that's to be expected. These
could potentially go into a candidates list which can be checked by a
human. We'll look more into that later. Hopefully this can get you started!
