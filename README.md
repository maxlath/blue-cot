[Bluebird](https://github.com/petkaantonov/bluebird)-based [Cot](https://github.com/willconant/cot-node) fork

# Installing
```
npm install blue-cot
```

## Differences with [Cot](https://github.com/willconant/cot-node)
* Returns [Bluebird](https://github.com/petkaantonov/bluebird) promises
* Class-less, thus a different initialization, but the rest of the API stays the same
* Consequently, `blue-cot` is `this`-free: no need to bind functions contexts!
* `4xx` and `5xx` responses will return rejected promises (should be handled with `.catch`)
* Adds [some view functions goodies](https://github.com/inventaire/blue-cot/blob/master/lib/view_functions.js)

### Initialization
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

### [API Reference](https://github.com/willconant/cot-node#promise--dbinfo)
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

### View functions
To access those, pass a design doc name as second argument
```js
const db = getDbApi('some-db-name', 'some-design-doc-name')
```

* viewCustom
* viewByKeysCustom
* viewByKey
* viewFindOneByKey
* viewByKeys

see [lib/view_functions](https://github.com/inventaire/blue-cot/blob/master/lib/view_functions.js)
