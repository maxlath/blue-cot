import { mapDoc, firstDoc } from './couch_helpers.js'
import { newError } from './errors.js'
import { validateString, validatePlainObject, validateArray, validateNonNull } from './utils.js'
import type dbHandle from './db_handle.js'
import type { ViewName, ViewKey, DocumentViewWithDocsParams, DesignDocName } from '../types/types.js'

export default function (db: ReturnType<typeof dbHandle>, designDocName: DesignDocName) {
  const viewFunctions = {
    async getDocsByViewQuery <D> (viewName: ViewName, query: DocumentViewWithDocsParams) {
      validateString(viewName, 'view name')
      validatePlainObject(query, 'query')
      const res = await db.view<unknown, D>(designDocName, viewName, query)
      // Assumes the view uses include_docs: true
      // to do without it, just use db.view)
      return mapDoc<D>(res)
    },

    async getDocsByViewKeysAndCustomQuery <D> (viewName: ViewName, keys: ViewKey[], query: DocumentViewWithDocsParams) {
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      validatePlainObject(query, 'query')
      const res = await db.viewKeys(designDocName, viewName, keys, query)
      return mapDoc<D>(res)
    },

    async getDocsByViewKey <D> (viewName: ViewName, key: ViewKey) {
      validateString(viewName, 'view name')
      validateNonNull(key, 'key')
      return viewFunctions.getDocsByViewQuery<D>(viewName, {
        key,
        include_docs: true,
      })
    },

    async findDocByViewKey <D> (viewName: ViewName, key: ViewKey) {
      validateString(viewName, 'view name')
      validateNonNull(key, 'key')
      const res = await viewFunctions.getDocsByViewQuery<D>(viewName, {
        key,
        include_docs: true,
        limit: 1,
      })
      const doc = firstDoc<D>(res)
      if (doc) {
        return doc
      } else {
        throw newError('Not Found', 404, [ viewName, key ])
      }
    },

    async getDocsByViewKeys <D> (viewName: ViewName, keys: ViewKey[]) {
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      return viewFunctions.getDocsByViewKeysAndCustomQuery<D>(viewName, keys, { include_docs: true })
    },
  }

  return viewFunctions
}
