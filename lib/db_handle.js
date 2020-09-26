const querystring = require('querystring')
const errors_ = require('./errors')
const recover = require('./recover_version')

module.exports = (jsonRequest, dbName) => {
  validateString(dbName, 'dbName')

  const API = {
    docUrl: docId => {
      validateString(docId, 'doc id')
      if (docId.indexOf('_design/') === 0) {
        return '/' + dbName + '/_design/' + encodeURIComponent(docId.substr(8))
      } else {
        return '/' + dbName + '/' + encodeURIComponent(docId)
      }
    },

    info: async () => {
      const res = await jsonRequest('GET', `/${dbName}`)
      return res.data
    },

    get: async (docId, revId) => {
      var url = API.docUrl(docId)
      if (typeof revId === 'string') url += `?rev=${revId}`
      const res = await jsonRequest('GET', url)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error getting doc ${docId}`)
    },

    exists: async docId => {
      try {
        const res = await jsonRequest('GET', API.docUrl(docId))
        if (res.statusCode === 200) return true
        else throw errors_.buildFromRes(res, `error getting doc ${docId}`)
      } catch (err) {
        if (err.statusCode === 404) return false
        else throw err
      }
    },

    put: async doc => {
      const res = await jsonRequest('PUT', API.docUrl(doc._id), doc)
      if (res.statusCode === 200 || res.statusCode === 201) return res.data
      else throw errors_.buildFromRes(res, `error putting doc ${doc._id}`)
    },

    post: async doc => {
      const res = await jsonRequest('POST', `/${dbName}`, doc)
      if (res.statusCode === 201) {
        return res.data
      } else if (doc._id) {
        throw errors_.buildFromRes(res, `error posting doc ${doc._id}`)
      } else {
        throw errors_.buildFromRes(res, `error posting new doc`)
      }
    },

    batch: async doc => {
      const path = `/${dbName}?batch=ok`
      const res = await jsonRequest('POST', path, doc)
      if (res.statusCode === 202) {
        return res.data
      } else if (doc._id) {
        throw errors_.buildFromRes(res, `error batch posting doc ${doc._id}`)
      } else {
        throw errors_.buildFromRes(res, `error batch posting new doc`)
      }
    },

    update: async (docId, fn) => {
      const db = API
      let attempt = 0
      const tryIt = async () => {
        if (++attempt > 10) throw errors_.new('too many attempts', 400, { docId, fn })
        // Throw if the doc doesn't exist
        const doc = await db.get(docId)
        try {
          const res = await db.put(fn(doc))
          if (res.ok) return res
          else return tryIt()
        } catch (err) {
          if (err.statusCode === 409) return tryIt()
          else throw err
        }
      }
      return tryIt()
    },

    delete: async (docId, rev) => {
      const url = API.docUrl(docId) + '?rev=' + encodeURIComponent(rev)
      const res = await jsonRequest('DELETE', url)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error deleting doc ${docId}`)
    },

    // Based on http://stackoverflow.com/a/16827094/3324977
    undelete: async docId => {
      try {
        // Verify that it's indeed a deleted document: if get doesn't throw, there is nothing to undelete
        await API.get(docId)
        throw errors_.new("can't undelete an non-deleted document", 400, docId)
      } catch (err) {
        if (err.statusCode !== 404 || err.body.reason !== 'deleted') throw err

        var url = API.docUrl(docId) + '?revs=true&open_revs=all'
        const res = await jsonRequest('GET', url)
        const data = res.data[0].ok
        const currentRev = data._rev
        const preDeleteRevNum = data._revisions.start - 1
        const preDeleteRevId = data._revisions.ids[1]
        const preDeleteRev = preDeleteRevNum + '-' + preDeleteRevId
        const preDeleteDoc = await API.get(docId, preDeleteRev)
        preDeleteDoc._rev = currentRev
        return API.put(preDeleteDoc)
      }
    },

    bulk: async docs => {
      const url = `/${dbName}/_bulk_docs`

      // Validate documents to avoid to get a cryptic
      // 'Internal Server Error' 500 CouchDB error
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        if (!isPlainObject(doc)) {
          throw errors_.new('invalid bulk doc', 400, { doc, index: i })
        }
      }

      const res = await jsonRequest('POST', url, { docs })
      if (res.statusCode !== 201) throw errors_.buildFromRes(res, `error posting to _bulk_docs`)

      for (let i = 0; i < res.data.length; i++) {
        if (res.data[i].error != null) {
          throw errors_.new('bulk response contains errors', 400, res.data)
        }
      }
      return res.data
    },

    buildQueryString: (query = {}) => {
      validatePlainObject(query, 'query')

      const q = {}
      viewQueryKeys.forEach(key => {
        // Avoid any possible conflict with object inherited attributes and methods
        if (query.hasOwnProperty(key)) {
          if (key === 'startkey_docid' || key === 'endkey_docid') {
            q[key] = query[key]
          } else {
            q[key] = JSON.stringify(query[key])
          }
        }
      })
      return querystring.stringify(q)
    },

    viewQuery: async (path, query) => {
      const qs = API.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      const res = await jsonRequest('GET', url)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error reading view ${path}`)
    },

    view: async (designName, viewName, query) => {
      return API.viewQuery(`_design/${designName}/_view/${viewName}`, query)
    },

    allDocs: async query => {
      return API.viewQuery('_all_docs', query)
    },

    viewKeysQuery: async (path, keys, query) => {
      const qs = API.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      const res = await jsonRequest('POST', url, { keys })
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error reading view ${path}`)
    },

    viewKeys: async (designName, viewName, keys, query) => {
      const path = `_design/${designName}/_view/${viewName}`
      return API.viewKeysQuery(path, keys, query)
    },

    // http://docs.couchdb.org/en/latest/api/database/bulk-api.html#post--db-_all_docs
    allDocsKeys: async (keys, query) => {
      return API.viewKeysQuery('_all_docs', keys, query)
    },

    fetch: async (keys, options) => {
      const throwOnErrors = options != null && options.throwOnErrors === true
      const { rows } = await API.viewKeysQuery('_all_docs', keys, { include_docs: true })
      const docs = []
      const errors = []
      for (const row of rows) {
        if (row.error) errors.push(row)
        else if (row.value.deleted) errors.push({ key: row.key, error: 'deleted' })
        else docs.push(row.doc)
      }
      if (throwOnErrors && errors.length > 0) throw errors_.new('docs fetch errors', 400, { keys, errors })
      return { docs, errors }
    },

    listRevs: async docId => {
      const url = API.docUrl(docId) + '?revs_info=true'
      const res = await jsonRequest('GET', url)
      return res.data._revs_info
    },

    revertLastChange: async docId => {
      const revsInfo = await API.listRevs(docId)
      const currentRevInfo = revsInfo[0]
      // Select only the previous one
      const candidatesRevsInfo = revsInfo.slice(1, 2)
      return recover(API, docId, candidatesRevsInfo, currentRevInfo)
    },

    revertToLastVersionWhere: async (docId, testFn) => {
      const revsInfo = await API.listRevs(docId)
      const currentRevInfo = revsInfo[0]
      const candidatesRevsInfo = revsInfo.slice(1)
      return recover(API, docId, candidatesRevsInfo, currentRevInfo, testFn)
    },

    changes: async (query = {}) => {
      const q = {}
      changesQueryKeys.forEach(key => {
        if (query[key] != null) q[key] = query[key]
      })
      if (query.longpoll) q.feed = 'longpoll'
      const qs = querystring.stringify(q)
      const path = `/${dbName}/_changes?${qs}`

      const res = await jsonRequest('GET', path)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error reading _changes`)
    }
  }

  return API
}

const viewQueryKeys = [
  'descending',
  'endkey',
  'endkey_docid',
  'group',
  'group_level',
  'include_docs',
  'inclusive_end',
  'key',
  'limit',
  'reduce',
  'skip',
  'stale',
  'startkey',
  'startkey_docid',
  'update_seq'
]

const changesQueryKeys = [
  'filter',
  'include_docs',
  'limit',
  'since',
  'timeout',
  'descending',
  'heartbeat',
  'style'
  // Not including feed as a possible option
  // as it doesn't play well with promises
  // 'feed'
]

const isPlainObject = obj => {
  return typeof obj === 'object' && !(Array.isArray(obj)) && obj !== null
}

const validateString = (str, label) => {
  if (typeof str !== 'string' || str.length === 0) {
    let errMessage = `invalid ${label}`
    if (str != null) errMessage += ` ${str} (${typeof str})`
    throw new TypeError(errMessage)
  }
}

const validatePlainObject = (obj, label) => {
  if (!isPlainObject(obj)) {
    throw new TypeError(`invalid ${label} object: ${JSON.stringify(obj)} (${typeof obj})`)
  }
}
