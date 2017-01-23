[CouchDB](http://couchdb.org/) library with a simple, functional-programing-friendly API, returning [Bluebird](https://github.com/petkaantonov/bluebird) promises.

Forked from [Cot](https://github.com/willconant/cot-node)

## Summary
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installing](#installing)
- [Differences with Cot](#differences-with-cot)
- [Initialization](#initialization)
- [API](#api)
  - [Common API](#common-api)
  - [Specific API](#specific-api)
    - [Additional database functions](#additional-database-functions)
      - [fetch](#fetch)
      - [list revs](#list-revs)
    - [View functions](#view-functions)
      - [viewCustom](#viewcustom)
      - [viewByKeysCustom](#viewbykeyscustom)
      - [viewByKey](#viewbykey)
      - [viewFindOneByKey](#viewfindonebykey)
      - [viewByKeys](#viewbykeys)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installing

```
npm install blue-cot
```

## Differences with [Cot](https://github.com/willconant/cot-node)

* Returns [Bluebird](https://github.com/petkaantonov/bluebird) promises
* Class-less, thus a different initialization, but the rest of the API stays the same
* Consequently, `blue-cot` is `this`-free: no need to bind functions contexts!
* `4xx` and `5xx` responses will return rejected promises (should be handled with `.catch`)
* Adds [some view functions goodies](https://github.com/inventaire/blue-cot/blob/master/lib/view_functions.js)

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

### Common API
[Cot API Documentation](https://github.com/willconant/cot-node#promise--dbinfo)

Those are the same than for `cot-node`. Just remember this difference in error handling: here, `4xx` and `5xx` responses from CouchDB will return rejected promises (should be handled with `.catch`)
* docUrl
* info
* get
* exists
* put
* post
* batch
* update
* delete
* bulk
* buildQueryString
* viewQuery
* view
* allDocs
* viewKeysQuery
* viewKeys
* allDocsKeys
* changes

### Specific API

#### Additional database functions
##### fetch

takes doc ids, returns docs
```js
db.fetch([ 'doc-1', 'doc-2', 'doc-3' ])
.then(function (docs) {
  docs[0]._id === 'doc-1' // true
  docs[1]._id === 'doc-2' // true
  docs[2]._id === 'doc-3' // true
})
```

##### list revs

takes a doc id, returns the doc's rev infos
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

#### View functions

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
