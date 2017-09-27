[CouchDB](http://couchdb.org/) library with a simple, functional-programing-friendly API, returning [Bluebird](https://github.com/petkaantonov/bluebird) promises.

Forked from [Cot](https://github.com/willconant/cot-node)

## Summary
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installing](#installing)
- [Specificities of this lib](#specificities-of-this-lib)
- [Initialization](#initialization)
- [API](#api)
  - [Database functions](#database-functions)
    - [info](#info)
  - [Documents functions](#documents-functions)
    - [get](#get)
    - [post](#post)
    - [put](#put)
    - [delete](#delete)
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
- [Tips](#tips)
  - [Cookie sessions](#cookie-sessions)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installing

```
npm install blue-cot
```

## Specificities of this lib
Especially compared to [Cot](https://github.com/willconant/cot-node) from which it is forked

* Returns [Bluebird](https://github.com/petkaantonov/bluebird) promises
* Class-less, thus a different initialization, but the rest of the API stays the same
* Consequently, `blue-cot` is `this`-free: no need to bind functions contexts!
* `4xx` and `5xx` responses will return rejected promises (should be handled with `.catch`)
* Adds [a few new functions](#specific-api), notably [some view functions goodies](https://github.com/inventaire/blue-cot/blob/master/lib/view_functions.js)
* Uses [Cookie Authentication](http://docs.couchdb.org/en/2.1.0/api/server/authn.html#cookie-authentication) instead of [Basic Auth](http://docs.couchdb.org/en/2.1.0/api/server/authn.html#basic-authentication) for better performance

## Initialization

```js
const bluecot = require('blue-cot')
const config = {
  // MUST
  hostname: 'localhost'
  port: 5984,

  // MAY
  ssl: true
  // use one of the two:
  // together
  auth: 'username:password'
  // or separated
  user: 'username'
  pass: 'password'
  // logs the generated URLs and body
  debug: true
}

const getDbApi = bluecot(config)

const db = getDbApi('some-db-name')
```

## API
### Database functions

To handle database and design documents creation, see [couch-init2](https://github.com/maxlath/couch-init2)

#### info
`GET /<dbName>`
```js
const promise = db.info()
```

### Documents functions
#### get
`GET /<dbName>/<docId>`

Takes a document id and optionaly a rev id to get a specific version:
```js
db.get('doc-1')
.then(function (lastDocVersion) {
  // do something
})

db.get('doc-1', '2-b8476e8877ff5707de9e62e70a8e0aeb')
.then(function (specificVersion) {
  // doc._rev === '2-b8476e8877ff5707de9e62e70a8e0aeb'
})
```

Missing documents are treated as an error, and thus return a rejected promise.

#### post
`POST /<dbName>`
```js
const promise = db.post(doc)
```

Creates a new document or updates an existing document. If `doc._id` is undefined, CouchDB will generate a new ID for you.

On 201, returns result from CouchDB which looks like: `{"ok":true, "id":"<docId>", "rev":"<docRev>"}`

All other status codes (including 409, conflict) are treated as errors, and thus return a rejected promise.

#### put
`PUT /<dbName>/<doc._id>`
```js
const promise = db.put(doc)
```

On 409 (conflict) returns result from CouchDB which looks like: `{"error":"conflict"}`

On 201, returns result from CouchDB which looks like: `{"ok":true, "id":"<docId>", "rev":"<docRev>"}`

All other status codes are treated as errors, and thus return a rejected promise.

#### delete
`DELETE /<dbName>/<docId>?rev=<rev>`
```js
const promise = db.delete(docId, rev)
```

On 200, returns result from CouchDB which looks like: `{"ok":true, "id":"<docId>", "rev":"<docRev>"}`

All other status codes are treated as errors, and thus return a rejected promise.

If you wish to gracefully handle update conflicts while deleting, use `db.put()` on a document with `_deleted` set to `true`:
```js
doc._deleted = true
db.put(doc)
.then(response => {
  if (!response.ok) {
    // there was a conflict
  }
})
```

#### exists
`GET /<dbName>/<docId>`
```js
const promise = db.exists(docId)
```

Returns a promise resolving to true if it exist, or a rejected promise if it doesn't.

#### batch
`POST /<dbName>?batch=ok`
```js
const promise = db.batch(doc)
```
doc: [`Batch Mode`](http://guide.couchdb.org/draft/performance.html#batch)

Creates or updates a document but doesn't wait for success. Conflicts will not be detected.

On 202, returns result from CouchDB which looks like: `{"ok":true, "id":"<docId>"}`

The rev isn't returned because CouchDB returns before checking for conflicts. If there is a conflict, the update will be silently lost.

All other status codes are treated as errors, and thus return a rejected promise.

#### update
```js
const promise = db.update(docId, updateFunction)
```
Gets the specified document, passes it to `updateFunction`, and then saves the results of `updateFunction` over the document

The process loops if there is an update conflict.

If `updateFunction` needs to do asynchronous work, it may return a promise.

#### bulk
`POST /<dbName>/_bulk_docs`
  ```js
const promise = db.bulk(docs)
```

See [CouchDB documentation](https://wiki.apache.org/couchdb/HTTP_Bulk_Document_API) for more information

#### allDocs
`GET /<dbName>/_all_docs?<properly encoded query>`
```js
const promise = db.allDocs(query)
```

Queries the `_all_docs` view. `query` supports the same keys as in [`db.view`](#view).

#### allDocsKeys
Loads documents with the specified keys and query parameters
```js
const promise = db.allDocsKeys(keys, query)
```
[Couchdb documentation](http://docs.couchdb.org/en/latest/api/database/bulk-api.html#post--db-_all_docs)

#### fetch
Takes doc ids, returns docs
```js
db.fetch([ 'doc-1', 'doc-2', 'doc-3' ])
.then(function (docs) {
  docs[0]._id === 'doc-1' // true
  docs[1]._id === 'doc-2' // true
  docs[2]._id === 'doc-3' // true
})
```

(That's pretty much the same thing as `db.allDocsKeys` but with the query object set to `{ include_docs: true }`)

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
db.listRevs('doc-1')
.then(function (revsInfo) {
  // do your thing
})
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
db.revertLastChange('doc-1')
```

#### revertToLastVersionWhere

Takes a doc id and a function, and reverts to the last version returning a truthy result when passed through this function.
Same warnings apply as for `revertLastChange`.

```js
const desiredVersionTestFunction = (doc) => doc.foo === 2

db.revertToLastVersionWhere('doc-1', desiredVersionTestFunction)
```

#### undelete
Mistakes happen
```js
db.delete(docId, docRev)
.then(res => db.undelete(docId))
.then(res => db.get(docId))
.then(restoredDoc => // celebrate)
```
:warning: this will obviously not work if the version before deletion isn't in the database (because the database was compressed or it's a freshly replicated database), or if the database was purged from deleted documents.

### View functions

#### view
`GET /<dbName>/_desgin/<designName>/_view/<viewName>?<properly encoded query>`
```js
const promise = db.view(designName, viewName, query)
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

see [lib/view_functions](https://github.com/inventaire/blue-cot/blob/master/lib/view_functions.js)

If you find this module useful, consider making a PR to improve the documentation

### Utils
#### buildQueryString

## Tips
### Cookie sessions
Since `v3.4.3`, authentification relies on [Cookie Sessions](http://docs.couchdb.org/en/2.1.0/api/server/authn.html#cookie-authentication) instead of [Basic Auth](http://docs.couchdb.org/en/2.1.0/api/server/authn.html#basic-authentication) for better performance. [By default, sessions timeout after 10 minutes of inactivity, but this can be adjusted](http://docs.couchdb.org/en/2.1.0/api/server/authn.html#cookie-authentication).

Indeed, from our [benchmark](https://github.com/maxlath/blue-cot/blob/master/benchmark/authentification.js):
* 1000 cookie get: 6.169ms
* 1000 basic auth get: 1354.313ms
