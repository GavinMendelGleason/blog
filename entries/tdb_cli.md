# Using TerminusDB from the Command Line: tdb-cli

*by Gavin and Guest Author Matthijs van Otterdijk*

This blog introduces our new command line tool for interacting with
TerminusDB, whther it be local or remote. The aim, eventually, is to
enable an easy to use command line client to carry out any of the
operations that are possible with TerminusDB, allowing fast
interactive development for thos just getting started, for tool chains
which include other tools, or for experts that just want a quick
one-liner rather than a script to perform some operation.

The tool (written by Matthijs) is written in TypeScript. We wanted to
be a bit more structured in our development than javascript gives you,
and we enjoyed the assistance that can be provided in interactive
development by the type checker.

We will give a quick tour of the basics

## Start a new terminusdb instance using docker

To start a new TerminusDB you can install
[docker](https://docs.docker.com/engine/install/) and run the
following:

```shell
docker run --rm -p 6363:6363 --pull always -d -v ./storage:/app/terminusdb/storage --name terminusdb terminusdb/terminusdb-server
```

This will get a new version of TerminusDB and launch it with the name
`terminusdb`. Note, that it will create a storage directory called
`storage` in the directory in which you currently reside! This will be
where your databases are kept (in case you wan to start another
terminusdb later with the same data).

## Configure tdb-cli

To configure `tdb-cli` you can run the interactive setup in a shell:

```shell
tdb-cli setup
```

To which tdb-cli will respond:

```shell
Welcome to tdb-cli, the CLI tool for TerminusDB!

This setup will ask a few questions to generate your configuration.
This configuration file will be stored at /home/matthijs/.tdb.yml.

? What instance of TerminusDB do you intend to connect to? Self-hosted TerminusDB
? What name do you wish to use for this server? local
? Server endpoint URL: http://localhost:6363
? Username: admin
? Password: root
? Default organization (blank if none): admin
Configuration has been written to /home/matthijs/.tdb.yml. You are all set!
```

You'll want to use the password `root` since this is what TerminusDB
comes with as a default admin password out of the box.

## Immediately change password

Since root isn't a great password, you'll probably want to start by
changing it:

```shell
tdb-cli user set-password
```

This will update both the server and your configuration.

## Create a database

Next we can create our first database:

```shell
tdb-cli db create family
```

## Add a schema

And we can now get the default (nearly empty) schema out:

```shell
tdb-cli doc get family -g schema > schema.json
```

add the following:

We can then add the following to this schema:

```shell
echo '
{
  "@type": "Class",
  "@id": "Person",
  "@key": {"@type": "Lexical",
           "@fields": ["name"]},
  "name": "xsd:string"
}
' >> schema.json
```

This defines a `Person` class, in which each `Person` has a
`name`. The ids of the objects are constructed with a lexical naming
scheme based on their name (the `{"@type": "Lexical", "@fields":
["name"]}` part, which makes remembering the ID of a document easier,
and bars the creation of duplicates.

Now we can put our schema into the database:

```shell
tdb-cli doc insert family -f -g schema < schema.json
```

## Adding data under schema control

Once we have a basic schema we can start adding data:

```shell
tdb-cli doc insert family -d '{"name": "Alice"}'
tdb-cli doc insert family -d '{"name": "Arthur"}'
tdb-cli doc insert family -d '{"name": "Bella"}'
tdb-cli doc insert family -d '{"name": "Briana"}'
tdb-cli doc insert family -d '{"name": "Bob"}'
tdb-cli doc insert family -d '{"name": "Clara"}'
tdb-cli doc insert family -d '{"name": "Carl"}'
```

This adds a number of people to the database.

## Change  the schema

We can also change the definition of a person in the schema, as long
as the change is compatible with the data we've added (in fact we can
also do it if it is incompatible with a schema migration, but that's a
different story).

Edit the `schema.json` and alter the `Person` record to be as follows:

```json
{
  "@id":"Person",
  "@key": {"@fields": ["name" ], "@type":"Lexical"},
  "@type":"Class",
  "child_of": {"@class":"Person", "@type":"Set"},
  "name":"xsd:string"
}
```

This definition adds a relationship between people. You can now be the
`child_of` two other `Person`s.

```shell
tdb-cli doc insert family -f -g schema < schema.json
```

## Create a graph

Now we can add some more *graph-like* data, which uses this `child_of`
relationship:

```shell
tdb-cli doc replace family -d '{"name": "Bella", "child_of": ["Person/Alice", "Person/Arthur"]}'
tdb-cli doc replace family -d '{"name": "Briana", "child_of": ["Person/Alice", "Person/Arthur"]}'
tdb-cli doc replace family -d '{"name": "Clara", "child_of": ["Person/Bella", "Person/Bob"]}'
```

## Launch GraphQL

Now that we have some graphy data, we can launch Graph

```shell
tdb-cli graphql serve family -o
```

This takes you to your browser with a GraphQL endpoint attached to
your database!

## Fun queries

And now we can try some fun queries!

### Get all people
```
query {
  Person {
    name
  }
}
```

### Get Bella and her parents
```
query {
  Person(filter:{name:{eq: "Bella"}}) {
    name
    child_of { name }
  }
}
```

### Get the children of Arthur
```
query {
  Person(filter:{name:{eq: "Arthur"}}) {
    name
    _child_of_of_Person {
      name
    }
  }
}
```

### Get all ancestors of Clara
```
query {
  Person(filter:{name:{eq: "Clara"}}) {
    name
		_path_to_Person(path:"child_of*") {
      name
    }
  }
}
```
