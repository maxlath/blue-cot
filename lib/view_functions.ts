import { mapDoc, firstDoc } from './couch_helpers.js'
import errors_ from './errors.js'
import { validateString, validatePlainObject, validateArray, validateNonNull } from './utils.js'
import type { ViewName, ViewKey, DocumentViewWithDocsParams } from '../types/types.js'

export default function (db, designDocName) {
  const viewFunctions = {
    async viewCustom <D> (viewName: ViewName, query: DocumentViewWithDocsParams) {
      validateString(viewName, 'view name')
      validatePlainObject(query, 'query')
      const res = await db.view(designDocName, viewName, query)
      // Assumes the view uses include_docs: true
      // to do without it, just use db.view)
      return mapDoc<D>(res)
    },

    async viewByKeysCustom <D> (viewName: ViewName, keys: ViewKey[], query: DocumentViewWithDocsParams) {
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      validatePlainObject(query, 'query')
      const res = await db.viewKeys(designDocName, viewName, keys, query)
      return mapDoc<D>(res)
    },

    async viewByKey <D> (viewName: ViewName, key: ViewKey) {
      validateString(viewName, 'view name')
      validateNonNull(key, 'key')
      return viewFunctions.viewCustom<D>(viewName, {
        key,
        include_docs: true,
      })
    },

    async viewFindOneByKey <D> (viewName: ViewName, key: ViewKey) {
      validateString(viewName, 'view name')
      validateNonNull(key, 'key')
      const res = await viewFunctions.viewCustom<D>(viewName, {
        key,
        include_docs: true,
        limit: 1,
      })
      const doc = firstDoc(res)
      if (doc) {
        return doc
      } else {
        throw errors_.new('Not Found', 404, [ viewName, key ])
      }
    },

    async viewByKeys <D> (viewName: ViewName, keys: ViewKey[]) {
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      return viewFunctions.viewByKeysCustom<D>(viewName, keys, { include_docs: true })
    },
  }

  return viewFunctions
}
