# Schema Migration

Data is always changing - that's why we have databases in the first
place! And it is not just the content, that changes, but also *the
shape* of the data.

I spend a lot of time thinking about change management for data - how
to make change requests with approval workflows function smoothly,
allowing users to update their content and see what it would look like
in practice before putting their data into production.

But part of the data lifecycle is managing these changes to the data
model itself.

## Schema Migration

In a normal RDBMS there is a command language of "schema" operations
that can be performed. You can add or drop tables, add or drop foreign
keys, and add or drop columns from your tables.

Similar things are needed in a graph database, where you will need to
add and drop edges in the graph, drop node types, add new node types,
and alter keys.

However, when it comes to *change management* with branches and
merges, things get a little bit trickier. To make things work
smoothly, we need to keep track of how we got where we are.

## Schema migrations as first class citizens

In the latest version of TerminusDB, we have added tracking of schema
migration to each *commit*. This schema migration information can be
used to ensure that branches can be made comparable, so that we can do
change requests between them.

In addition, this will later allow us to have *model products* which
can be updated in ways that downstream users of the model products can
track the schema alterations without having to figure out how to alter
their data.

## *Weakening* and *Strengthening* of Schemas

We can split the kinds of schema changes into two types: *weakening*
and *strengthening*.

A weakening operation is backward compatible. It changes the schema in
such a way that it can not invalidate data which already exists, and
does not require any change to be made to existing data.

In an SQL world this might be something like adding a new table, or
adding a nullable column to a table.

In TerminusDB it means operations such as adding optional or set
properties to a class, or adding new classes, or extending an enum
with new values.

One additional interesting point about these operations is that the
operations can be *inferred*. We can guess from the addition of a new
schema document, or update of a schema document that it is a
*weakening* operation, which means you don't have to explicitly
migrate your schema, but can just edit the schema directly.

## Weakening Inferrence

So how might we infer a schema migration? Let's demonstrate with with
the command line tool.

```shell
terminusdb db create admin/m
echo '{ "@type" : "Class", "@id" : "A", "a": "xsd:string" }' | ./terminusdb doc insert admin/m -g schema
```

We have created a new database (called `m`), and added one type of
class `A` to the schema.

If we look at the log of this (with the verbose flag) we can see the
inferred migration reported.

```shell
terminusdb log admin/m -v
```

And you'll get something along the lines of:

```
wrhzet2rzenaiud9dc7nw03gbgwfsof
--------------------------------
Date: 2023-04-21T11:24:49+00:00
Author: admin
Message: cli: document insert
Migration:
[
    {
	"@type":"CreateClass",
	"class_document": {"@id":"A", "@type":"Class", "a":"xsd:string"}
    }
]
```

The migration operation to obtain this schema has been inferred.

In addition we can make a slightly more complex change to the schema
which is also a weakening, such as:

```shell
echo '{ "@type" : "Class", "@id" : "A", "a" : "xsd:string", "b" : { "@type" : "Optional", "@class" : "xsd:boolean" }}' | terminusdb doc replace admin/m -g schema
```

The most recent commit is given from the command:

```shell
terminusdb log admin/m -v -c 1
```

And it will now be along the lines of:

```
cezsjyywg7o1r2f1fj6otvod5ka6zqa
--------------------------------
Date: 2023-04-21T11:26:35+00:00
Author: admin
Message: cli: document replace
Migration:
[
    {
	"@type":"CreateClassProperty",
	"class":"A",
	"property":"b",
	"type": {"@class":"xsd:boolean", "@type":"Optional"}
    }
]
```

This migration operation tells the system that we updated the class
`A` with a *weakening* operation.

Strengthening operations are also possible implicitly using inference
but we have not exposed this feature yet as it is still experimental
(it can potentially change your instance data!)

## Explicit Migration

It is also possible to perform explicit migrations, whether
strengthening or weakening, by stating them explicitly through the API
or via the CLI.

First, lets add a bit of data to illustrate.

```shell
echo '{ "a" : "foo", "b": true }' | terminusdb doc insert admin/m
```

This is now legal because of our above alterations which introduced
the `b` property.

Now, to add a new required property `c` to our class `A` which is an
integer, we can write the following:

```shell
terminusdb migration admin/m --operations '[{"@type" : "CreateClassProperty", "class" : "A", "property" : "c", "type" : "xsd:integer", "default" : 0 }]'
```

This returns:

```
{"instance_operations":1, "schema_operations":1}
```

Meaning that we changed the data in the database.

To see this we can get the documents back out:

```shell
terminusdb doc get admin/m
```

Which returns:

```
{"@id":"A/86b5201b5e907ad916ed650b7656828a8f89bea12edf50ecfd341cd290194695","@type":"A","a":"foo","b":true,"c":"0"}
```

With a new default value of 0 (represented as a string, unfortunately,
since it is in fact an unbounded integer which causes problems with
many programming languages if not represented as a string).

## Targetting a migration

This is pretty great in itself as we can migrate the shape of our data
even when we have instance data, but it's especially important when
doing change-request type workflows.

For instance, if I branch the database now (branching with an implicit
base of `main`):

```shell
terminusdb branch create admin/m/local/branch/other
```

I can now update the `main` branch again as follows:

```shell
echo '{ "@type" : "Class", "@id" : "B", "b": "xsd:string" }' | ./terminusdb doc insert admin/m -g schema
```

Now my `other` branch has difficulties in comparing with the `main`
branch since the schema is not symmetric.

To alleviate this problem I can simply *target* the schema of the
branch in main by writing:

```shell
terminusdb migration admin/m/local/branch/other -t admin/m
```

Now if I look at the schema, I'll see that it has been made symmetric,
including in adding default values on a required property!

```shell
terminusdb doc get admin/m/local/branch/other
```

Returning:

```
{"@id":"A/86b5201b5e907ad916ed650b7656828a8f89bea12edf50ecfd341cd290194695","@type":"A","a":"foo","b":true,"c":"0"}
```

## Conclusion

Of course this requires that we have migrations the entire way along,
so we'll be adding a mode which forces all schema updates (via the
document interface or otherwise) to have a valid migration, or throw
an error.

And for *model products* which are meant to be imported as schema
components for other data products, this should also be required.

However if you keep to explicit migrations for schema changes, or
restrict to weakening operations, you should always be able to move
your branches along with you.

Hope you enjoy the new-found model flexibility!
