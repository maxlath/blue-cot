[CouchDB](http://couchdb.org/) library with a simple, functional-programing-friendly API.

Forked from [Cot](https://github.com/willconant/cot-node), and renamed `blue-cot` in reference to the [Bluebird](https://github.com/petkaantonov/bluebird) promises it was returning until `v4.0.0`.

## Summary
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installing](#installing)
- [Specificities of this lib](#specificities-of-this-lib)
- [Initialization](#initialization)
  - [with Bluebird](#with-bluebird)
- [API](#api)
  - [Database functions](#database-functions)
    - [info](#info)
  - [Documents functions](#documents-functions)
    - [get](#get)
    - [post](#post)
    - [put](#put)
    - [delete](#delete)
    - [find](#find)
    - [postIndex](#postindex)
    - [exists](#exists)
    - [batch](#batch)
    - [update](#update)
    - [bulk](#bulk)
    - [allDocs](#alldocs)
    - [allDocsKeys](#alldocskeys)
    - [fetch](#fetch)
    - [changes](#changes)
    - [listRevs](#listrevs)
    - [revertLastChange](#revertlastchange)
    - [revertToLastVersionWhere](#reverttolastversionwhere)
    - [undelete](#undelete)
  - [View functions](#view-functions)
    - [view](#view)
    - [viewQuery](#viewquery)
    - [viewKeysQuery](#viewkeysquery)
    - [viewKeys](#viewkeys)
    - [Design doc specific view functions](#design-doc-specific-view-functions)
      - [viewCustom](#viewcustom)
      - [viewByKeysCustom](#viewbykeyscustom)
      - [viewByKey](#viewbykey)
      - [viewFindOneByKey](#viewfindonebykey)
      - [viewByKeys](#viewbykeys)
  - [Utils](#utils)
    - [buildQueryString](#buildquerystring)
- [See also](#see-also)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installing

```
npm install blue-cot
```

## Specificities of this lib
Especially compared to [Cot](https://github.com/willconant/cot-node) from which it is forked

* Class-less, thus a different initialization, but the rest of the API stays the same
* Consequently, `blue-cot` is `this`-free: no need to bind functions contexts!
* `4xx` and `5xx` responses will return rejected promises (should be handled with `.catch`)
* Adds [a few new functions](#specific-api), notably [some view functions goodies](https://github.com/inventaire/blue-cot/blob/master/lib/view_functions.js)
* Uses [Cookie Authentication](http://docs.couchdb.org/en/2.1.0/api/server/authn.html#cookie-authentication) instead of [Basic Auth](http://docs.couchdb.org/en/2.1.0/api/server/authn.html#basic-authentication) for better performance
* Uses a single persistent connexion to CouchDB by default

## Initialization

```js
const bluecot = require('blue-cot')
const config = {
  // Required
  protocol: 'http',
  hostname: 'localhost',
  port: 5984,

  // Required if the database you are querying requires authentification
  username: 'your-couchdb-username',
  password: 'your-couchdb-password',

  // Optinonal
  // Logs the generated URLs, body, and response time
  debug: true, // default: false

  // The default http agent already sets keepAlive=true
  // but if for some reason you want to pass your own http agent, you can.
  // Some documentation on the subject of http agents
  // https://nodejs.org/api/http.html#http_class_http_agent
  // https://github.com/bitinn/node-fetch#custom-agent
  // And the recommandations of the official CouchDB NodeJS lib
  // https://github.com/apache/couchdb-nano#pool-size-and-open-sockets
  agent: myAgent
}

const getDbApi = bluecot(config)

const db = getDbApi('some-db-name')
```

### with Bluebird
From `v4.0.0`, `blue-cot` stopped returning [Bluebird](https://github.com/petkaantonov/bluebird) promises, but if you miss that feature, you can recover it by initializing `bluebird` before `blue-cot`:
```js
global.Promise = require('bluebird')
const bluecot = require('blue-cot')
const getDbApi = bluecot(config)
const db = getDbApi('some-db-name')
```

## API
### Database functions

To handle database and design documents creation, see [couch-init2](https://github.com/maxlath/couch-init2)

#### info
`GET /<dbName>`
```js
const data = await db.info()
```

### Documents functions
#### get
`GET /<dbName>/<docId>`

Takes a document id and optionaly a rev id to get a specific version:
```js
const latestDocVersion = await db.get('doc-1')

const specificVersion = await db.get('doc-1', '2-b8476e8877ff5707de9e62e70a8e0aeb')
```

Missing documents are treated as an error, and thus return a rejected promise.

#### post
`POST /<dbName>`
```js
const res = await db.post(doc)
```

Creates a new document or updates an existing document. If `doc._id` is undefined, CouchDB will generate a new ID for you.

On 201, returns result from CouchDB which looks like: `{"ok":true, "id":"<docId>", "rev":"<docRev>"}`

All other status codes (including 409, conflict) are treated as errors, and thus return a rejected promise.

#### put
`PUT /<dbName>/<doc._id>`
```js
const res = await db.put(doc)
```

On 409 (conflict) returns result from CouchDB which looks like: `{"error":"conflict"}`

On 201, returns result from CouchDB which looks like: `{"ok":true, "id":"<docId>", "rev":"<docRev>"}`

All other status codes are treated as errors, and thus return a rejected promise.

#### delete
`DELETE /<dbName>/<docId>?rev=<rev>`
```js
const res = await db.delete(docId, rev)
```

On 200, returns result from CouchDB which looks like: `{"ok":true, "id":"<docId>", "rev":"<docRev>"}`

All other status codes are treated as errors, and thus return a rejected promise.

If you wish to gracefully handle update conflicts while deleting, use `db.put()` on a document with `_deleted` set to `true`:
```js
doc._deleted = true
const res = await db.put(doc)
if (!res.ok) {
  // something went wrong, possibly a conflict
}
```

#### find
`POST /<dbName>/_find_` (endpoint available in CouchDB `>= 2.0`)

Takes a [`_find` query object](https://docs.couchdb.org/en/stable/api/database/find.html)

```js
const { docs, bookmark } = await db.find({
  selector: {
    year: { $gt: 2010 }
  },
  fields: [ '_id', '_rev', 'year', 'title' ],
  sort: [ { year: 'asc' } ],
  limit: 2,
  skip: 0,
  use_index: [ 'some_design_doc_name', 'some_index_name' ],
  execution_stats: true
})
```

By default, this function will throw if receiving a warning; this behavior can be disable by passing `strict=false`:
```js
const query = {
  selector: {
    year: { $gt: 2010 }
  }
}
const { docs, bookmark, warning } = await db.find(query, { strict: false })
```

To send the same query to the [`_explain`](https://docs.couchdb.org/en/stable/api/database/find.html#db-explain) endpoint instead, use the `explain` flag:

```js
const query = {
  selector: { name: 'foo' }
}
const { docs, bookmark, warning } = await db.find(query, { explain: true )
```

#### postIndex
`POST /<dbName>/_index`

```js
const { result } = await db.postIndex({
  index: {
    fields: [ 'type' ]
  },
  ddoc: 'some_ddoc_name',
  name: 'by_type'
})
```

#### exists
`GET /<dbName>/<docId>`
```js
const res = await db.exists(docId)
```

Returns a promise resolving to true if it exist, or a rejected promise if it doesn't.

#### batch
`POST /<dbName>?batch=ok`
```js
const res = await db.batch(doc)
```
doc: [`Batch Mode`](http://guide.couchdb.org/draft/performance.html#batch)

Creates or updates a document but doesn't wait for success. Conflicts will not be detected.

On 202, returns result from CouchDB which looks like: `{"ok":true, "id":"<docId>"}`

The rev isn't returned because CouchDB returns before checking for conflicts. If there is a conflict, the update will be silently lost.

All other status codes are treated as errors, and thus return a rejected promise.

#### update
```js
const res = await db.update(docId, updateFunction)
```
Gets the specified document, passes it to `updateFunction`, and then saves the results of `updateFunction` over the document

The process loops if there is an update conflict.

By default, `db.update` only accepts to update existing docs, but this can be changed by setting `createIfMissing=true`:
```js
const res = await db.update(docId, updateFunction, { createIfMissing: true })
```

#### bulk
`POST /<dbName>/_bulk_docs`
  ```js
const res = await db.bulk(docs)
```

See [CouchDB documentation](https://wiki.apache.org/couchdb/HTTP_Bulk_Document_API) for more information

#### allDocs
`GET /<dbName>/_all_docs?<properly encoded query>`
```js
const { rows } = await db.allDocs(query)
```

Queries the `_all_docs` view. `query` supports the same keys as in [`db.view`](#view).

#### allDocsKeys
Loads documents with the specified keys and query parameters
```js
const { rows } = await db.allDocsKeys(keys, query)
```
[Couchdb documentation](http://docs.couchdb.org/en/latest/api/database/bulk-api.html#post--db-_all_docs)

#### fetch
Takes doc ids, returns docs.
```js
const { docs, errors } = await db.fetch([ 'doc-1', 'doc-2', 'doc-3', 'some-non-existing-doc' ])
docs[0]._id === 'doc-1' // true
docs[1]._id === 'doc-2' // true
docs[2]._id === 'doc-3' // true
errors[0].key === 'some-non-existing-doc' // true
errors[0].error === 'not_found' // true
```

#### changes
Queries the changes feed given the specified query. `query` may contain the following keys:
* `filter`: filter function to use
* `include_docs`: if true, results will contain entire document
* `limit`: the maximum number of change rows this query should return
* `since`: results will start immediately after the sequence number provided here
* `longpoll`: if true, query will send feed=longpoll
* `timeout`: timeout in milliseconds for logpoll queries

See [CouchDB changes feed documentation](http://wiki.apache.org/couchdb/HTTP_database_API#Changes)

#### listRevs

Takes a doc id, returns the doc's rev infos
```js
const revsInfo = await db.listRevs('doc-1')
```
`revsInfo` will look something like:
```
[
  { rev: '3-6a8869bc7fff815987ff9b7fda3e10e3', status: 'available' },
  { rev: '2-88476e8877ff5707de9e62e70a8e0aeb', status: 'available' },
  { rev: '1-a8bdf0ef0b7049d35c781210723b9ff9', status: 'available' }
]
```

#### revertLastChange

Takes a doc id and reverts its last change, recovering the previous version.
Only works if there is a previous version and if it is still available in the database (that is, if it wasn't deleted by a database compaction).
It doesn't delete the last version, it simply creates a new version that is exactly like the version before the current one.

```js
const res = await db.revertLastChange('doc-1')
```

#### revertToLastVersionWhere

Takes a doc id and a function, and reverts to the last version returning a truthy result when passed through this function.
Same warnings apply as for `revertLastChange`.

```js
const desiredVersionTestFunction = doc => doc.foo === 2

db.revertToLastVersionWhere('doc-1', desiredVersionTestFunction)
```

#### undelete
Mistakes happen
```js
await db.delete(docId, docRev)
await db.undelete(docId))
const restoredDoc = await db.get(docId))
```
:warning: this will obviously not work if the version before deletion isn't in the database (because the database was compressed or it's a freshly replicated database), or if the database was purged from deleted documents.

### View functions

#### view
`GET /<dbName>/_desgin/<designName>/_view/<viewName>?<properly encoded query>`
```js
const { rows, total_rows, offset } = db.view(designName, viewName, query)
```
Queries a view with the given name in the given design doc. `query` should be an object with any of the following keys:
* descending
* endkey
* endkey_docid
* group
* group_level
* include_docs
* inclusive_end
* key
* limit
* reduce
* skip
* stale
* startkey
* startkey_docid
* update_seq

For more information, refer to [Couchdb documentation](http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options)

#### viewQuery
#### viewKeysQuery
#### viewKeys

#### Design doc specific view functions
Those functions are pre-filled versions of the view functions above for the most common operations, like to get all the documents associated to an array of ids.

To access those, pass a design doc name as second argument
```js
const db = getDbApi('some-db-name', 'some-design-doc-name')
```

##### viewCustom
##### viewByKeysCustom
##### viewByKey
##### viewFindOneByKey
##### viewByKeys

see [lib/view_functions](https://github.com/maxlath/blue-cot/blob/master/lib/view_functions.js)

If you find this module useful, consider making a PR to improve the documentation

### Utils
#### buildQueryString

## See also
you might want to consider using [couchdb-nano](https://github.com/apache/couchdb-nano), the now offical (but bloated ;p) CouchDB NodeJS lib
