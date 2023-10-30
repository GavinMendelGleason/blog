# Syntax Directed Query: Using Typescript with GraphQL and TerminusDB

![Traversing the graph](../assets/three_dimensional_heads_up_display_of_person.png)

TerminusDB provides a very convenient environment for GraphQL. And
there are few environments more natural for GraphQL than
typescript. So how can I use typescript and TerminusDB together?

We took [genql](https://genql.dev/) for a spin and found it presents a
very nice environment for just this problem. We will show you how to
get started with GenQL, GraphQL, TerminusDB and Typescript quickly.

We all know that types can help to give static guarantees about
correctness, but typescript has shown that it can be used to provide
contextual information to help simplify and drive development. A type
system can help your editor help you write code. And coupled with
GraphQL you can be sure to write syntactically correct queries with
help at every step.

TerminusDB's philosophy is likewise built around leveraging the value
of type information to drive high quality data design.

We'll explore one possible approach here. Using TerminusDB data models
to help create a GraphQL application with [genql](https://genql.dev/).

This approach does not use GraphQL queries directly embedded in your
syntax, as is common in JavaScript, as we see below:

```javascript
gql`
query {
  People(filter:{label:{startsWith:"Luke"}}){
    label
    desc
    film{
      label
    }
  }
}
`
```

Instead, we have a type correct but convenient AST. Let's see how this
works.

## Spinning up a TerminusDB

The easiest way to spin up a TerminusDB is described in the
[TerminusDB repository](https://github.com/terminusdb/terminusdb). We
want a local installation of TerminusDB for this tutorial, but you
could also make this work against the cloud offering.

## Creating a TerminusDB schema

The first step with most TerminusDB data products is to create a
schema. To do this we can just use our command line client to clone a
resource from TerminusCMS.

```bash
terminusdb clone https://cloud.terminusdb.com/public/Terminusdb_demo/star_wars --user=anonymous --password=any
```

## Installing GenQL

Assuming you already use typescript and have a node / npm environment
already set up, you can just run:

```bash
npm i -g @genql/cli
```

If not, first see these [instructions for npm
installation](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).

## Getting a graphql schema from TerminusDB

Now that you have a local version of TerminusDB we can generate the
graphql schema types in our typescript environment. This is as easy as
invoking `genql`

```bash
genql --endpoint http://localhost:6363/api/graphql/admin/star_wars --output ./generated
```

## Creating a graphql query

We can create a file `index.ts` with the code in the following
snippet. The first bits with import (which imports the generated
schema) and the client construction are boiler plate.  The next part
is the query. As you can see the arguments to a graphql query are
specified with `__args:`, and fields simply keys with `true` if they
are concrete datatypes, or objects themselves specifying additional
subfields.

```typescript
import { createClient } from "./generated";

const client = createClient({
  url: "http://localhost:6363/api/graphql/admin/star_wars",
  headers: {
    Authorization: "Basic YWRtaW46cm9vdA==",
  },
});

client
  .query({
    People : {
      __args: {
        filter: {
          label : {
            startsWith: "Luke"
          }
        }
      },
      label:true,
      desc : true,
      film: {
        label: true
      }
    }
  })
  .then(arg => console.log(JSON.stringify(arg, null, 4)))
```

If you are using a modern syntax aware editor such as the vscode,
eclipse or emacs with a typescript mode, then your editor will tell
you every field that can be used at any point! Try getting
auto-completions by modifying this query.

## Running your query

You can run this query with the following invocation:

```shell
tsx index.ts
```

This gives the result:

```json
{
    "People": [
        {
            "label": "Luke Skywalker",
            "desc": [
                "In 2015, the character was selected by Empire magazine as the 50th greatest movie character of all time.[2] On their list of the 100 Greatest Fictional Characters, Fandomania.com ranked the character at number 14.[3]",
                "Luke Skywalker is a fictional character and the main protagonist of the original film trilogy of the Star Wars franchise created by George Lucas. The character, portrayed by Mark Hamill, is an important figure in the Rebel Alliance's struggle against the Galactic Empire. He is the twin brother of Rebellion leader Princess Leia Organa of Alderaan, a friend and brother-in-law of smuggler Han Solo, an apprentice to Jedi Masters Obi-Wan \"Ben\" Kenobi and Yoda, the son of fallen Jedi Anakin Skywalker (Darth Vader) and Queen of Naboo/Republic Senator Padmé Amidala and maternal uncle of Kylo Ren / Ben Solo. The now non-canon Star Wars expanded universe depicts him as a powerful Jedi Master, husband of Mara Jade, the father of Ben Skywalker and maternal uncle of Jaina, Jacen and Anakin Solo."
            ],
            "film": [
                {
                    "label": "A New Hope"
                },
                {
                    "label": "The Empire Strikes Back"
                },
                {
                    "label": "Return of the Jedi"
                },
                {
                    "label": "Revenge of the Sith"
                },
                {
                    "label": "The Force Awakens"
                }
            ]
        }
    ]
}
```

Have fun playing around with your new GraphQL endpoint!
