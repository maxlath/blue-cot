import querystring from 'node:querystring'
import errors_ from './errors.js'
import { recover } from './recover_version.js'
import { isPlainObject, validateString, validateArray, validatePlainObject } from './utils.js'
import { changesQueryKeys, viewQueryKeys } from './query_keys.js'

/**
 * @typedef { import('../types/types.d.ts').DocId } DocId
 * @typedef { import('../types/types.d.ts').DocRev } DocRev
 * @typedef { import('../types/types.d.ts').Doc } Doc
 * @typedef { import('../types/types.d.ts').DocTranformer } DocTranformer
 * @typedef { import('../types/types.d.ts').UpdateOptions } UpdateOptions
 * @typedef { import('../types/types.d.ts').ViewQuery } ViewQuery
 * @typedef { import('../types/types.d.ts').ChangesQuery } ChangesQuery
 * @typedef { import('../types/types.d.ts').FindQuery } FindQuery
 * @typedef { import('../types/types.d.ts').ViewKeys } ViewKeys
 * @typedef { import('../types/types.d.ts').FetchOptions } FetchOptions
 * @typedef { import('../types/types.d.ts').TestFunction } TestFunction
 * @typedef { import('../types/types.d.ts').FindOptions } FindOptions
 * @typedef { import('../types/types.d.ts').IndexDoc } IndexDoc
 * @typedef { import('../types/types.d.ts').JsonRequest } JsonRequest
 */

/**
  * @param {JsonRequest} jsonRequest
  * @param {DocRev} [docRev]
  */
export default function (jsonRequest, dbName) {
  validateString(dbName, 'dbName')

  const API = {
    /**
     * @param {DocId} docId
     */
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

    /**
     * @param {DocId} docId
     * @param {DocRev} [docRev]
     */
    get: async (docId, docRev) => {
      let url = API.docUrl(docId)
      if (typeof docRev === 'string') url += `?rev=${docRev}`
      const res = await jsonRequest('GET', url)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error getting doc ${docId}`)
    },

    /**
     * @param {DocId} docId
     */
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

    /**
     * @param {Doc} doc
     */
    put: async doc => {
      validatePlainObject(doc, 'doc')
      const res = await jsonRequest('PUT', API.docUrl(doc._id), doc)
      if (res.statusCode === 200 || res.statusCode === 201) return res.data
      else throw errors_.buildFromRes(res, `error putting doc ${doc._id}`)
    },

    /**
     * @param {Doc} doc
     */
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

    /**
     * @param {Doc} doc
     */
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

    /**
     * @param {DocId} docId
     * @param {DocTranformer} fn
     * @param {UpdateOptions | null} options
     */
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

    /**
     * @param {DocId} docId
     * @param {DocRev} rev
     */
    delete: async (docId, rev) => {
      validateString(rev, 'rev')
      const url = API.docUrl(docId) + '?rev=' + encodeURIComponent(rev)
      const res = await jsonRequest('DELETE', url)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error deleting doc ${docId}`)
    },

    // Based on http://stackoverflow.com/a/16827094/3324977
    /**
     * @param {DocId} docId
     */
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

    /**
     * @param {Doc[]} docs
     */
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

    /**
     * @param {ViewQuery | null} query
     */
    buildQueryString: query => buildSanitizedQueryString(query, viewQueryKeys),

    /**
     * @param {string} path
     * @param {ViewQuery | null} query
     */
    viewQuery: async (path, query) => {
      const qs = API.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      const res = await jsonRequest('GET', url)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error reading view ${path}`)
    },

    /**
     * @param {string} designName
     * @param {string} viewName
     * @param {ViewQuery | null} query
     */
    view: async (designName, viewName, query) => {
      validateString(designName, 'design doc name')
      validateString(viewName, 'view name')
      validatePlainObject(query, 'query')
      return API.viewQuery(`_design/${designName}/_view/${viewName}`, query)
    },

    /**
     * @param {ViewQuery | null} query
     */
    allDocs: async query => {
      return API.viewQuery('_all_docs', query)
    },

    /**
     * @param {string} path
     * @param {ViewKeys} keys
     * @param {ViewQuery | null} query
     */
    viewKeysQuery: async (path, keys, query = {}) => {
      validateString(path, 'path')
      validateArray(keys, 'keys')
      const qs = API.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      const res = await jsonRequest('POST', url, { keys })
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, `error reading view ${path}`)
    },

    /**
     * @param {string} designName
     * @param {string} viewName
     * @param {ViewKeys} keys
     * @param {ViewQuery | null} query
     */
    viewKeys: async (designName, viewName, keys, query) => {
      validateString(designName, 'design doc name')
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      validatePlainObject(query, 'query')
      const path = `_design/${designName}/_view/${viewName}`
      return API.viewKeysQuery(path, keys, query)
    },

    /**
     * @param {ViewKeys} keys
     * @param {ViewQuery | null} query
     */
    // http://docs.couchdb.org/en/latest/api/database/bulk-api.html#post--db-_all_docs
    allDocsKeys: async (keys, query) => {
      return API.viewKeysQuery('_all_docs', keys, query)
    },

    /**
     * @param {ViewKeys} keys
     * @param {FetchOptions | null} options
     */
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

    /**
     * @param {DocId} docId
     */
    listRevs: async docId => {
      const url = API.docUrl(docId) + '?revs_info=true'
      const res = await jsonRequest('GET', url)
      return res.data._revs_info
    },

    /**
     * @param {DocId} docId
     */
    revertLastChange: async docId => {
      const revsInfo = await API.listRevs(docId)
      const currentRevInfo = revsInfo[0]
      // Select only the previous one
      const candidatesRevsInfo = revsInfo.slice(1, 2)
      return recover(API, docId, candidatesRevsInfo, currentRevInfo)
    },

    /**
     * @param {DocId} docId
     * @param {TestFunction} testFn
     */
    revertToLastVersionWhere: async (docId, testFn) => {
      const revsInfo = await API.listRevs(docId)
      const currentRevInfo = revsInfo[0]
      const candidatesRevsInfo = revsInfo.slice(1)
      return recover(API, docId, candidatesRevsInfo, currentRevInfo, testFn)
    },

    /**
     * @param {ChangesQuery | null} query
     */
    changes: async (query = {}) => {
      const qs = buildSanitizedQueryString(query, changesQueryKeys)
      const path = `/${dbName}/_changes?${qs}`

      const res = await jsonRequest('GET', path)
      if (res.statusCode === 200) return res.data
      else throw errors_.buildFromRes(res, 'error reading _changes')
    },

    /**
     * @param {FindQuery | null} query
     * @param {FindOptions | null} options
     */
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

    /**
     * @param {IndexDoc} indexDoc
     */
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
