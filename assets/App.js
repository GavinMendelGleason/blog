import './App.css';
/* Markdown */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rangeParser from 'parse-numeric-range'
/* Loading Spinner */
import ClipLoader from 'react-spinners/ClipLoader';
//import LoadingIcons from 'react-loading-icons'
/* GraphQL */
import { ApolloClient,ApolloLink, concat, InMemoryCache, ApolloProvider,
         gql, HttpLink, useQuery } from '@apollo/client'
/* Routing */
import {Routes, Route, useParams, useRoutes} from 'react-router-dom'
/* Syntax highlighting */
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript'
import scss from 'react-syntax-highlighter/dist/cjs/languages/prism/scss'
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash'
import markdown from 'react-syntax-highlighter/dist/cjs/languages/prism/markdown'
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json'
import rust from 'react-syntax-highlighter/dist/cjs/languages/prism/rust'
import graphql from 'react-syntax-highlighter/dist/cjs/languages/prism/graphql'
import turtle from 'react-syntax-highlighter/dist/cjs/languages/prism/turtle'

SyntaxHighlighter.registerLanguage('turtle', turtle)
SyntaxHighlighter.registerLanguage('ttl', turtle)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('scss', scss)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('markdown', markdown)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('graphql', graphql)

const syntaxTheme = oneDark
const MarkdownComponents = {
    code({ node, inline, className, ...props }) {
      const match = /language-(\w+)|(diagram)/.exec(className || '')
      const hasMeta = node?.data?.meta

      const applyHighlights  = (applyHighlights) => {
        if (hasMeta) {
          const RE = /{([\d,-]+)}/
          const metadata = node.data.meta?.replace(/\s/g, '')
          const strlineNumbers = RE?.test(metadata)
            ? RE?.exec(metadata)[1]
            : '0'
          const highlightLines = rangeParser(strlineNumbers)
          const highlight = highlightLines
          const data = highlight.includes(applyHighlights)
            ? 'highlight'
            : null
          return { data }
        } else {
          return {}
        }
      }
      return match ? (
          <SyntaxHighlighter
           style={syntaxTheme}
           language={match[1]}
           PreTag="div"
           className="codeStyle"
           showLineNumbers={true}
           useInlineStyles={true}
           lineProps={applyHighlights}
           {...props}
        />
      ) : (
          <code className={className} {...props} />
        /*
        <SyntaxHighlighter
           style={syntaxTheme}
           language="diagram"
           className="codeStyle"
           showLineNumbers={false}
           useInlineStyles={true}
        {...props}
        />*/
      )
    },
}

/* GraphQL Boilerplate */
const httpLink = new HttpLink({ uri: "http://localhost:6363/api/graphql/admin/blog" });
const authMiddleware = new ApolloLink((operation, forward) => {
  // add the authorization to the headers
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      authorization: "Basic YWRtaW46cm9vdA==",
    }

  }));
  return forward(operation);
})

const ComposedLink = concat(authMiddleware, httpLink)

const cache = new InMemoryCache({
  addTypename: false,
});

const client = new ApolloClient({
  cache: cache,
  link: ComposedLink,
});

/* GraphQL Queries */
const POSTS_QUERY = gql`
 query PostsQuery($offset: Int, $limit: Int) {
    Post(offset: $offset, limit: $limit, orderBy: { date : DESC }) {
        id
        date
        title
        content
        feature {
           alt
           location
        }
    }
}`

const POST_QUERY = gql`
 query PostQuery($id: ID) {
    Post(id: $id) {
        id
        date
        title
        content
    }
}`

const SITEMAP_QUERY = gql`
query SitemapQuery {
    SiteMap {
        items(orderBy: { order : ASC }) {
           id
           name
           location
        }
    }
}`

const PAGE_QUERY = gql`
 query PageQuery($id: ID) {
    Page(id: $id) {
        id
        title
        content
    }
}`

/* Text Processing */
function snippit(content, size=20) {
  content = content.replace(/!\[[^\]]*\]\([^\)]*\)/g,'')
  content = content.replace(/```[^`]*```/g,'')
  const matcher = new RegExp(`^(.*\n){0,${size}}`, 'g')
  const result = matcher.exec(content)
  if(result !== null) {
    return result[0]
  }else{
    return content.substring(0,100)
  }
}

/* The App */
/*function Loading() {
  return (
        <LoadingIcons.Hearts stroke="#3dffc5" fill="#3dffc5" alignment-baseline="central" />
  )
}*/

function Loading() {
  const style = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  return (
      <div style={style}>
        <ClipLoader color="#3dffc5" />
      </div>
  )
}

function SiteMap() {
  const { loading, error, data } = useQuery(SITEMAP_QUERY);
  if (loading) return <div className='topnav'><Loading /></div>;
  if (error) return `Error! ${error.message}`;
  const SiteItems = data.SiteMap[0].items
  return (
      <div className='topnav'>
      {SiteItems.map((item) =>
          <span key={item.id} className="siteLink" id={item.id}><a href={item.location}>{item.name}</a></span>
       )}
      </div>
  )
}

function get_page_number(){
  const path = window.location.pathname
  const re = /^\/p\/(.*)/;
  if (re.exec(path)) {
    // We are a page
    const m = re.exec(path)
    const i = parseInt(m[1])
    if(i){
      return i
    }else{
      return 0
    }
  }else{
    return 0
  }
}

function get_offsets() {
  const page_number = get_page_number()
  return { offset: 10 * page_number,
           limit: 10}
}

function More(){
  const next_page_number = get_page_number() + 1;
  const offsets = {
    offset: 10 * next_page_number,
    limit:1
  }
  const { loading, error, data } = useQuery(POSTS_QUERY, {variables:offsets});
  if (loading) return <Loading />;
  if (error) return `Error! ${error.message}`;
const next_path = `/p/${next_page_number}`
  return (
      <div key="more" name="morePosts">
        {data.Post.map((post) => <a key="more_ref" href={next_path}>More posts</a>)}
      </div>
  )
}

function Image(image){
  return (
    <td className='blogImage' ><img className='Thumbnail' src={image.location} alt={image.alt} /></td>
  )
}

function PostRiver() {
  const offsets = get_offsets()
  const { loading, error, data } = useQuery(POSTS_QUERY, {variables:offsets});
  if (loading) return <Loading />;
  if (error) return `Error! ${error.message}`;
  return (
    <div>
      <div name='post_river'>
      {data.Post.map((post) => {
          const date_time_obj = new Date(post.date);
          var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
          var date_time = date_time_obj.toLocaleDateString("en-US", options)
          var id = post.id.replace(/^iri:\/\/data/, '')
          var path = `${id}`
          var content = snippit(post.content) + `... **[see more](${path})**`
          var image = post.feature ? Image(post.feature) : ''
          return (
           <div key={id} id={id} name='BlogCard'>
             <table className='blogTable'>
              <tbody>
              <tr>
                <td className='blogData'>
                  <span><h2><a href={path}>{post.title}</a></h2></span><em>{date_time}</em>
                  <ReactMarkdown components={MarkdownComponents}>
                  {content}
                  </ReactMarkdown>
                </td>
                {image}
              </tr>
              </tbody>
             </table>
             <hr />
          </div>
          )})}
      </div>
      <More />
    </div>
  );
}

function Post() {
  var path = window.location.pathname
  var id = path.substring(1,path.length)
  id = "iri://data/" + id
  const { loading, error, data } = useQuery(POST_QUERY, {variables:{id:id}});
  if (loading) return <Loading />
  if (error) return `Error! ${error.message}`;
  return (
    <div name='post'>
      <SiteMap />
      {data.Post.map((post) => {

        const date_time_obj = new Date(post.date);
        var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        var date_time = date_time_obj.toLocaleDateString("en-US", options)
        var id = post.id.replace(/^iri:\/\/data/, '')
        var content = post.content
        return (
          <div key={id} id={id}>
            <span><h1>{post.title}</h1></span><em>{date_time}</em>
            <ReactMarkdown components={MarkdownComponents} remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
       </div>
      )})}
    </div>
  )
}

function Page() {
  var path = window.location.pathname
  var id = path.substring(1,path.length)
  id = "iri://data/" + id
  const { loading, error, data } = useQuery(PAGE_QUERY, {variables:{id:id}});
  if (loading) return 'Loading...';
  if (error) return `Error! ${error.message}`;
  return (
    <div name='page'>
      <SiteMap />
      {data.Page.map((page) => {
        var id = page.id.replace(/^iri:\/\/data/, '')
        var content = page.content
        return (
          <div id={id}>
            <span><h1>{page.title}</h1></span>
            <ReactMarkdown components={MarkdownComponents} remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
       </div>
      )})}
    </div>
  )
}

function Posts() {
  return (
      <div className="App">
          <ApolloProvider client={client}>
            <SiteMap />
            <ReactMarkdown>
              # Gavin's Technical Blog
            </ReactMarkdown>
            <PostRiver />
          </ApolloProvider>
      </div>
  )
}

function SinglePost() {
  return (
      <div className="App">
         <ApolloProvider client={client}>
              <Post />
         </ApolloProvider>
      </div>
  )
}


function SinglePage() {
  return (
      <div className="App">
         <ApolloProvider client={client}>
              <Page />
         </ApolloProvider>
      </div>
  )
}

function App() {
  let routes = useRoutes([
    { path: "/", element: <Posts /> },
    { path: "p", children : [
       { path: ":page", element: <Posts /> }]},
    { path: "Post", children : [
       { path: ":id", element: <SinglePost /> }]},
    { path: "Page", children : [
       { path: ":id", element: <SinglePage /> }]}
  ]);
  return routes;
}

export default App;
