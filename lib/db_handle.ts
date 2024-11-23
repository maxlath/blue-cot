import querystring from 'node:querystring'
import { buildErrorFromRes, newError } from './errors.js'
import { changesQueryKeys, viewQueryKeys } from './query_keys.js'
import { isPlainObject, validateString, validateArray, validatePlainObject, isIdentifiedDocument } from './utils.js'
import type { CreateIndexRequest, CreateIndexResponse, DatabaseChangesParams, DatabaseChangesResponse, Document, DocumentBulkResponse, DocumentDestroyResponse, DocumentFetchResponse, DocumentGetResponse, DocumentInsertParams, DocumentInsertResponse, DocumentLookupFailure, DocumentViewQuery, DocumentViewResponse, IdentifiedDocument, InfoResponse, MangoResponse } from '../types/nano.js'
import type { DocId, DocRev, DocTranformer, FetchOptions, FindOptions, FindQuery, JsonRequest, NewDoc, TestFunction, RecoveredDoc, UpdateOptions, ViewKey, DocumentDeletedFailure, RevInfo, DocumentRevertResponse, DocumentViewKeysQuery } from 'types/types.js'

export default function (jsonRequest: JsonRequest, dbName: string) {
  validateString(dbName, 'dbName')

  const db = {
    docUrl: (docId: DocId) => {
      validateString(docId, 'doc id')
      if (docId.indexOf('_design/') === 0) {
        return '/' + dbName + '/_design/' + encodeURIComponent(docId.substr(8))
      } else {
        return '/' + dbName + '/' + encodeURIComponent(docId)
      }
    },

    info: async () => {
      const res = await jsonRequest<InfoResponse>('GET', `/${dbName}`)
      return res.data
    },

    get: async <D> (docId: DocId, docRev?: DocRev) => {
      let url = db.docUrl(docId)
      if (typeof docRev === 'string') url += `?rev=${docRev}`
      const res = await jsonRequest<DocumentGetResponse & D>('GET', url)
      if (res.statusCode === 200) return res.data
      else throw buildErrorFromRes(res, `error getting doc ${docId}`)
    },

    exists: async (docId: DocId) => {
      try {
        const res = await jsonRequest<DocumentGetResponse>('GET', db.docUrl(docId))
        if (res.statusCode === 200) return true
        else throw buildErrorFromRes(res, `error getting doc ${docId}`)
      } catch (err) {
        if (err.statusCode === 404) return false
        else throw err
      }
    },

    put: async (doc: IdentifiedDocument | RecoveredDoc, params?: DocumentInsertParams) => {
      validatePlainObject(doc, 'doc')
      const url = buildUrl(db.docUrl(doc._id), params)
      const res = await jsonRequest<DocumentInsertResponse>('PUT', url, doc)
      if (res.statusCode === 200 || res.statusCode === 201 || (params.batch && res.statusCode === 202)) return res.data
      else throw buildErrorFromRes(res, `error putting doc ${doc._id}`)
    },

    post: async (doc: NewDoc, params?: DocumentInsertParams) => {
      validatePlainObject(doc, 'doc')
      const url = buildUrl(`/${dbName}`, params)
      const res = await jsonRequest<DocumentInsertResponse>('POST', url, doc)
      if (res.statusCode === 201 || (params.batch && res.statusCode === 202)) {
        return res.data
      } else if (isIdentifiedDocument(doc)) {
        throw buildErrorFromRes(res, `error posting doc ${doc._id}`)
      } else {
        throw buildErrorFromRes(res, 'error posting new doc')
      }
    },

    update: async (docId: DocId, fn: DocTranformer, options: UpdateOptions = {}): Promise<DocumentInsertResponse> => {
      let attempt = 0
      const { createIfMissing } = options
      const tryIt = async () => {
        if (++attempt > 10) throw newError('too many attempts', 400, { docId, fn })
        let doc
        try {
          doc = await db.get(docId)
        } catch (err) {
          if (err.statusCode === 404 && createIfMissing) doc = { _id: docId }
          else throw err
        }
        try {
          const data = await db.put(fn(doc))
          if (data.ok) return data
          else return tryIt()
        } catch (err) {
          if (err.statusCode === 409) return tryIt()
          else throw err
        }
      }
      return tryIt()
    },

    delete: async (docId: DocId, rev: DocRev) => {
      validateString(rev, 'rev')
      const url = db.docUrl(docId) + '?rev=' + encodeURIComponent(rev)
      const res = await jsonRequest<DocumentDestroyResponse>('DELETE', url)
      if (res.statusCode === 200) return res.data
      else throw buildErrorFromRes(res, `error deleting doc ${docId}`)
    },

    // Based on http://stackoverflow.com/a/16827094/3324977
    undelete: async (docId: DocId) => {
      validateString(docId, 'doc id')
      try {
        // Verify that it's indeed a deleted document: if get doesn't throw, there is nothing to undelete
        await db.get(docId)
        throw newError("can't undelete an non-deleted document", 400, docId)
      } catch (err) {
        if (err.statusCode !== 404 || err.body.reason !== 'deleted') throw err

        const url = db.docUrl(docId) + '?revs=true&open_revs=all'
        const res = await jsonRequest<DocumentGetResponse>('GET', url)
        const data = res.data[0].ok
        const preDeleteRevNum = data._revisions.start - 1
        const preDeleteRevId = data._revisions.ids[1]
        const preDeleteRev = preDeleteRevNum + '-' + preDeleteRevId
        const preDeleteDoc: RecoveredDoc = await db.get(docId, preDeleteRev)
        delete preDeleteDoc._rev
        return db.put(preDeleteDoc)
      }
    },

    bulk: async (docs: Document[]) => {
      validateArray(docs, 'docs')
      const url = `/${dbName}/_bulk_docs`

      // Validate documents to avoid to get a cryptic
      // 'Internal Server Error' 500 CouchDB error
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        if (!isPlainObject(doc)) {
          throw newError('invalid bulk doc', 400, { doc, index: i })
        }
      }

      const res = await jsonRequest<DocumentBulkResponse[]>('POST', url, { docs })
      if (res.statusCode !== 201) throw buildErrorFromRes(res, 'error posting to _bulk_docs')

      for (const part of res.data) {
        if (part.error != null) {
          const statusCode = part.error === 'conflict' ? 409 : 400
          throw newError('bulk response contains errors', statusCode, { body: res.data })
        }
      }
      return res.data
    },

    buildQueryString: (query?: DocumentViewQuery) => buildSanitizedViewQueryString(query, viewQueryKeys),

    viewQuery: async <K, V, D, ID>(path: string, query?: DocumentViewQuery) => {
      const qs = db.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      const res = await jsonRequest<DocumentViewResponse<K, V, D, ID>>('GET', url)
      if (res.statusCode === 200) return res.data
      else throw buildErrorFromRes(res, `error reading view ${path}`)
    },

    view: async <K, V, D, ID>(designName: string, viewName: string, query: DocumentViewQuery) => {
      validateString(designName, 'design doc name')
      validateString(viewName, 'view name')
      validatePlainObject(query, 'query')
      return db.viewQuery<K, V, D, ID>(`_design/${designName}/_view/${viewName}`, query)
    },

    allDocs: async <K, V, D, ID>(query?: DocumentViewQuery) => {
      return db.viewQuery<K, V, D, ID>('_all_docs', query)
    },

    viewKeysQuery: async <K, V, D, ID>(path: string, keys: ViewKey[], query: DocumentViewKeysQuery = {}) => {
      validateString(path, 'path')
      validateArray(keys, 'keys')
      const qs = db.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      const res = await jsonRequest<DocumentViewResponse<K, V, D, ID>>('POST', url, { keys })
      if (res.statusCode === 200) return res.data
      else throw buildErrorFromRes(res, `error reading view ${path}`)
    },

    viewKeys: async <K, V, D, ID>(designName: string, viewName: string, keys: ViewKey[], query?: DocumentViewKeysQuery) => {
      validateString(designName, 'design doc name')
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      validatePlainObject(query, 'query')
      const path = `_design/${designName}/_view/${viewName}`
      return db.viewKeysQuery<K, V, D, ID>(path, keys, query)
    },

    // http://docs.couchdb.org/en/latest/db/database/bulk-db.html#post--db-_all_docs
    allDocsKeys: async (keys: ViewKey[], query: DocumentViewKeysQuery) => {
      return db.viewKeysQuery('_all_docs', keys, query)
    },

    fetch: async <D>(keys: ViewKey[], options?: FetchOptions) => {
      validateArray(keys, 'keys')
      const throwOnErrors = options != null && options.throwOnErrors === true
      const res = await db.allDocsKeys(keys, { include_docs: true })
      const rows = res.rows as DocumentFetchResponse<D>['rows']
      const docs: D[] = []
      const errors: (DocumentLookupFailure | DocumentDeletedFailure)[] = []
      for (const row of rows) {
        if (isDocumentLookupFailure(row)) errors.push(row)
        // @ts-expect-error Property 'deleted' does not exist on type '{ rev: string; }'.ts(2339)
        else if (row.value.deleted) errors.push({ key: row.key, error: 'deleted' })
        else docs.push(row.doc as D)
      }
      if (throwOnErrors && errors.length > 0) throw newError('docs fetch errors', 400, { keys, errors })
      return { docs, errors }
    },

    listRevs: async (docId: DocId) => {
      const url = db.docUrl(docId) + '?revs_info=true'
      const res = await jsonRequest<DocumentGetResponse>('GET', url)
      return res.data._revs_info as RevInfo[]
    },

    revertLastChange: async (docId: DocId) => {
      const revsInfo = await db.listRevs(docId)
      const currentRevInfo = revsInfo[0]
      // Select only the previous one
      const candidatesRevsInfo = revsInfo.slice(1, 2)
      return db.recover(docId, candidatesRevsInfo, currentRevInfo)
    },

    revertToLastVersionWhere: async (docId: DocId, testFn: TestFunction) => {
      const revsInfo = await db.listRevs(docId)
      const currentRevInfo = revsInfo[0]
      const candidatesRevsInfo = revsInfo.slice(1)
      return db.recover(docId, candidatesRevsInfo, currentRevInfo, testFn)
    },

    changes: async (query: DatabaseChangesParams = {}) => {
      const qs = buildSanitizedViewQueryString(query, changesQueryKeys)
      const path = `/${dbName}/_changes?${qs}`

      const res = await jsonRequest<DatabaseChangesResponse>('GET', path)
      if (res.statusCode === 200) return res.data
      else throw buildErrorFromRes(res, 'error reading _changes')
    },

    find: async <D>(query: FindQuery = {}, options: FindOptions = {}) => {
      let endpoint = '_find'
      if (options.explain) endpoint = '_explain'
      const path = `/${dbName}/${endpoint}`
      const res = await jsonRequest<MangoResponse<D>>('POST', path, query)
      if (res.statusCode === 200) {
        const { warning } = res.data
        if (query.use_index != null && warning != null && warning.includes('No matching index found')) {
          throw newError('No matching index found', 400, { path, query, options, warning })
        } else {
          return res.data
        }
      } else {
        throw buildErrorFromRes(res, 'find error')
      }
    },

    postIndex: async (indexDoc: CreateIndexRequest) => {
      validatePlainObject(indexDoc, 'index doc')
      const res = await jsonRequest<CreateIndexResponse>('POST', `/${dbName}/_index`, indexDoc)
      if (res.statusCode === 200 || res.statusCode === 201) return res.data
      else throw buildErrorFromRes(res, 'postIndex error')
    },

    recover: async (docId: DocId, candidatesRevsInfo: RevInfo[], currentRevInfo: RevInfo, testFn?: TestFunction) => {
      const previousRevInfo = candidatesRevsInfo.shift()

      if (previousRevInfo == null) {
        throw newError('no previous version could be found', 400, { docId, candidatesRevsInfo, currentRevInfo })
      }

      if (previousRevInfo.status !== 'available') {
        throw newError('previous version isnt available', 400, { docId, candidatesRevsInfo, currentRevInfo })
      }

      const targetVersion = await db.get(docId, previousRevInfo.rev)
      if (typeof testFn === 'function' && !testFn(targetVersion)) {
        return db.recover(docId, candidatesRevsInfo, currentRevInfo, testFn)
      }
      const revertRev = targetVersion._rev
      targetVersion._rev = currentRevInfo.rev
      const res: DocumentRevertResponse = await db.put(targetVersion)
      res.revert = revertRev
      return res
    },
  }

  return db
}

const buildSanitizedViewQueryString = (query = {}, queryKeys) => {
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
    throw newError('invalid query key', 400, { key, query, validKeys: Object.keys(queryKeys) })
  }
}

function isDocumentLookupFailure (row): row is DocumentLookupFailure {
  return row.error != null
}

function buildUrl (path, params) {
  if (params) {
    return `${path}?${querystring.stringify(params)}`
  } else {
    return path
  }
}
