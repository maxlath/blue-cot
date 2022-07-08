const querystring = require('querystring')
const errors_ = require('./errors')
const recover = require('./recover_version')
const { isPlainObject, validateString, validateArray, validatePlainObject } = require('./utils')

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
      let url = API.docUrl(docId)
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
      validatePlainObject(doc, 'doc')
      const res = await jsonRequest('PUT', API.docUrl(doc._id), doc)
      if (res.statusCode === 200 || res.statusCode === 201) return res.data
      else throw errors_.buildFromRes(res, `error putting doc ${doc._id}`)
    },

    post: async doc => {
      validatePlainObject(doc, 'doc')
      const res = await jsonRequest('POST', `/${dbName}`, doc)
      if (res.statusCode === 201) {
        return res.data
      } else if (doc._id) {
        throw errors_.buildFromRes(res, `error posting doc ${doc._id}`)
      } else {
        throw errors_.buildFromRes(res, 'error posting new doc')
      }
    },

    batch: async doc => {
      validatePlainObject(doc, 'doc')
      const path = `/${dbName}?batch=ok`
      const res = await jsonRequest('POST', path, doc)
      if (res.statusCode === 202) {
        return res.data
      } else if (doc._id) {
        throw errors_.buildFromRes(res, `error batch posting doc ${doc._id}`)
      } else {
        throw errors_.buildFromRes(res, 'error batch posting new doc')
      }
    },

    update: async (docId, fn, options = {}) => {
      const db = API
      let attempt = 0
      const { createIfMissing } = options
      const tryIt = async () => {
        if (++attempt > 10) throw errors_.new('too many attempts', 400, { docId, fn })
        let doc
        try {
          doc = await db.get(docId)
        } catch (err) {
          if (err.statusCode === 404 && createIfMissing) doc = { _id: docId }
          else throw err
        }
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
      validateString(rev, 'rev')
      const url = API.docUrl(docId) + '?rev=' + encodeURIComponent(rev)
      const res = await jsonRequest('DELETE', url)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error deleting doc ${docId}`)
    },

    // Based on http://stackoverflow.com/a/16827094/3324977
    undelete: async docId => {
      validateString(docId, 'doc id')
      try {
        // Verify that it's indeed a deleted document: if get doesn't throw, there is nothing to undelete
        await API.get(docId)
        throw errors_.new("can't undelete an non-deleted document", 400, docId)
      } catch (err) {
        if (err.statusCode !== 404 || err.body.reason !== 'deleted') throw err

        const url = API.docUrl(docId) + '?revs=true&open_revs=all'
        const res = await jsonRequest('GET', url)
        const data = res.data[0].ok
        const preDeleteRevNum = data._revisions.start - 1
        const preDeleteRevId = data._revisions.ids[1]
        const preDeleteRev = preDeleteRevNum + '-' + preDeleteRevId
        const preDeleteDoc = await API.get(docId, preDeleteRev)
        // Re-created documents shouldn't have a rev, see https://github.com/apache/couchdb/issues/3177
        delete preDeleteDoc._rev
        return API.put(preDeleteDoc)
      }
    },

    bulk: async docs => {
      validateArray(docs, 'docs')
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
      if (res.statusCode !== 201) throw errors_.buildFromRes(res, 'error posting to _bulk_docs')

      for (const part of res.data) {
        if (part.error != null) {
          const statusCode = part.error === 'conflict' ? 409 : 400
          throw errors_.new('bulk response contains errors', statusCode, { body: res.data })
        }
      }
      return res.data
    },

    buildQueryString: query => buildSanitizedQueryString(query, viewQueryKeys),

    viewQuery: async (path, query) => {
      const qs = API.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      const res = await jsonRequest('GET', url)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error reading view ${path}`)
    },

    view: async (designName, viewName, query) => {
      validateString(designName, 'design doc name')
      validateString(viewName, 'view name')
      validatePlainObject(query, 'query')
      return API.viewQuery(`_design/${designName}/_view/${viewName}`, query)
    },

    allDocs: async query => {
      return API.viewQuery('_all_docs', query)
    },

    viewKeysQuery: async (path, keys, query = {}) => {
      validateString(path, 'path')
      validateArray(keys, 'keys')
      const qs = API.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      const res = await jsonRequest('POST', url, { keys })
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error reading view ${path}`)
    },

    viewKeys: async (designName, viewName, keys, query) => {
      validateString(designName, 'design doc name')
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      validatePlainObject(query, 'query')
      const path = `_design/${designName}/_view/${viewName}`
      return API.viewKeysQuery(path, keys, query)
    },

    // http://docs.couchdb.org/en/latest/api/database/bulk-api.html#post--db-_all_docs
    allDocsKeys: async (keys, query) => {
      return API.viewKeysQuery('_all_docs', keys, query)
    },

    fetch: async (keys, options) => {
      validateArray(keys, 'keys')
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
      const qs = buildSanitizedQueryString(query, changesQueryKeys)
      const path = `/${dbName}/_changes?${qs}`

      const res = await jsonRequest('GET', path)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, 'error reading _changes')
    },

    find: async (query = {}, options = {}) => {
      let endpoint = '_find'
      if (options.explain) endpoint = '_explain'
      const path = `/${dbName}/${endpoint}`
      const res = await jsonRequest('POST', path, query)
      if (res.statusCode === 200) {
        const { warning } = res.data
        if (query.use_index != null && warning != null && warning.includes('No matching index found')) {
          throw errors_.new('No matching index found', 400, { path, query, options, warning })
        } else {
          return res.data
        }
      } else {
        throw errors_.buildFromRes(res, 'find error')
      }
    },

    postIndex: async indexDoc => {
      validatePlainObject(indexDoc, 'index doc')
      const res = await jsonRequest('POST', `/${dbName}/_index`, indexDoc)
      if (res.statusCode === 200 || res.statusCode === 201) return res.data
      else throw errors_.buildFromRes(res, 'postIndex error')
    }
  }

  return API
}

const buildSanitizedQueryString = (query = {}, queryKeys) => {
  validatePlainObject(query, 'query')
  const q = {}
  for (const key of Object.keys(query)) {
    // Avoid any possible conflict with object inherited attributes and methods
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      validateQueryKey(queryKeys, key, query)
      if (query[key] != null) {
        if (queryKeys[key] === 'json') {
          q[key] = JSON.stringify(query[key])
        } else {
          q[key] = query[key]
        }
      }
    }
  }
  return querystring.stringify(q)
}

const validateQueryKey = (queryKeys, key, query) => {
  if (queryKeys[key] == null) {
    throw errors_.new('invalid query key', 400, { key, query, validKeys: Object.keys(queryKeys) })
  }
}

// Source: https://docs.couchdb.org/en/latest/api/ddoc/views.html
const viewQueryKeys = {
  conflicts: 'boolean',
  descending: 'boolean',
  endkey: 'json',
  end_key: 'json',
  endkey_docid: 'string',
  end_key_doc_id: 'string',
  group: 'boolean',
  group_level: 'number',
  include_docs: 'boolean',
  attachments: 'boolean',
  att_encoding_info: 'boolean',
  inclusive_end: 'boolean',
  key: 'json',
  keys: 'json',
  limit: 'number',
  reduce: 'boolean',
  skip: 'number',
  sorted: 'boolean',
  stable: 'boolean',
  stale: 'string',
  startkey: 'json',
  start_key: 'json',
  startkey_docid: 'string',
  start_key_doc_id: 'string',
  update: 'string',
  update_seq: 'boolean',
}

// Source: https://docs.couchdb.org/en/latest/api/database/changes.html
const changesQueryKeys = {
  doc_ids: 'json',
  conflicts: 'boolean',
  descending: 'boolean',
  // Not including feed as a possible option as it doesn't play well with promises
  // feed: 'string',
  filter: 'string',
  heartbeat: 'number',
  include_docs: 'boolean',
  attachments: 'boolean',
  att_encoding_info: 'boolean',
  'last-event-id': 'number',
  limit: 'number',
  style: 'string',
  since: 'string',
  timeout: 'number',
  view: 'string',
  seq_interval: 'number',
}
