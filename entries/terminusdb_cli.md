# TerminusDB CLI for Push / Pull / Clone

TerminusDB is designed to be a distributed database with a
collaboration model designed to rhyme with the ideas behind git. It is
essentially meant to be a *git for data*.

The building blocks of the model are:

* Revision Control: We have commits for every update
* Diff: Differences between commits can be interpreted as patches between states.
* Push/Pull/Clone: We can communicate diffs between nodes using push / pull / clone.

## Clone

The simplest way to see how the TerminusDB CLI can be used is to clone
a resource from TerminusX. This is analogous to creating a repository on GitHub.

First we log into TerminusX, create a new data product, and make sure
we have an access token to the team in which we created that data
product. Then copy the URL to clone from the data product info page.

Supposing I make a data product called `example` in the team
`Terminators`. We could then issue the following command using the
TerminusDB CLI.

```shell
./terminusdb clone 'https://cloud-dev.terminusdb.com/Terminators/example' --token='XYZ'
```

Once completed, you'll have a local copy of this database!

```shell
./terminusdb list
TerminusDB
│
└── admin/example
    └── main
```

Now we can put something interesting in our database. First, let's create the following schema.

For a file `schema.json`:
```javascript
{ "@id" : "Person",
  "@type" : "Class",
  "name" : "xsd:string",
  "occupation" : "xsd:string",
  "friends" : { "@type" : "Set",
                "@class" : "Person" }
}
```

```shell
./terminusdb doc insert admin/example --graph_type=schema --message='adding base schema' < schema.json
```

Now that we have the schema we can go ahead and submit a
document. Let's start with something simple.

```shell
./terminusdb doc insert admin/example --message='adding Gavin' --data='{"@type" : "Person","name" : "Gavin", "occupation" : "Coder"}'
```

Now let's take a look at our history:

```shell
./terminusdb log

b10d1z9vzp060utfa4rtptt823woskf
----------------------------------
Date: 2022-04-25T11:02:07+00:00
Author: admin
Message: adding Gavin

afcy8b5p86m16fpnh3b7ktp3zfpaku
----------------------------------
Date: 2022-04-25T11:01:59+00:00
Author: admin
Message: adding base schema
```

Great! We've our schema update and our document insertion. Now that we have some new data, we can have a go at pushing.

## Push

First, let's see what kinds of switches we have with push:

```shell
./terminusdb push

terminusdb push DB_SPEC

Push a branch.

--help           -h  boolean=false  print help for the `push` command
--branch         -b  atom=main      set the origin branch for push
--remote-branch  -e  atom=_         set the branch on the remote for push
--remote         -r  atom=origin    the name of the remote to use
--prefixes       -x  boolean=false  send prefixes for database
--token          -t  atom=_         machine access token
--user           -u  atom=_         the user on the remote
--password       -p  atom=_         the password on the remote
```

Here we see that we can define a remote for the push command. Since we
cloned the database, `origin` will already be the correct remote. We
can see this by typing:

```shell
./terminusdb remote get-url admin/example

Remote origin associated with url https://cloud.terminusdb.com/Terminators/Terminators/example
```

Because of this, our push command just needs our authentication token (the one we used to clone).

```shell
./terminusdb push admin/example --token='...'

admin/example pushed: new("71030a31c7057e6cd9cb9e354ede032717023aa6")
```

Great! We now have our data on the TerminusX!

## Managing Change

We can now go in to the server and create a new Person, Jane through
the document UI in TerminusX. Once this is done, we can then do the following:

```shell
./terminusdb pull admin/example --token='...'
admin/example pulled: status{'api:fetch_status':true,'api:pull_status':"api:pull_fast_forwarded"}
```

Now we can dump the documents and see what is in there:

```shell
./terminusdb doc get admin/example
{"@id":"Person/23d01a9462711b84029147fd0a92611174023de946e00bdc2fb79b44e25e48f5", "@type":"Person", "name":"Gavin", "occupation":"Coder"}
{"@id":"Person/c2a53dec09e9805593b978ecca7f73cecb18cddae70645e7037d202d2a9fd185", "@type":"Person", "friends": ["Person/23d01a9462711b84029147fd0a92611174023de946e00bdc2fb79b44e25e48f5" ], "name":"Jane", "occupation":"Nuclear Physicist"}
```

Look at that! We've synced our changes.

And if we look at the log...

```shell
./terminusdb log admin/example

ijrcvs8el838we97vl3p19vu4g6me7q
--------------------------------
Date: 2022-04-25T11:52:18+00:00
Author: gavin@terminusdb.com
Message: Adding a new instance of type Person

bb92atqjkqx40linuwxlp5y0jlpawkc
--------------------------------
Date: 2022-04-25T11:48:42+00:00
Author: admin
Message: adding Gavin

twg58rv4ohaw887k7ewej2j1hhm1pwt
--------------------------------
Date: 2022-04-25T11:48:36+00:00
Author: admin
Message: adding base schema
```

## Conclusion

The CLI allows us to directly modify a store, whether the server is
running or not. This is possible due to the immutable datastorage
approach token in TerminusDB and is a pretty cool feature of
immutability.

We can also sync these stores and keep history of edits made remotely.

In a following article I'll show how we can use `pull` with diverging
histories, for when some edits have taken place which result in
conflicts.

Happy terminating!
