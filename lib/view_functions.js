import { mapDoc, firstDoc } from './couch_helpers.js'
import errors_ from './errors.js'
import { validateString, validatePlainObject, validateArray, validateNonNull } from './utils.js'

export default function (API, designDocName) {
  return {
    async viewCustom (viewName, query) {
      validateString(viewName, 'view name')
      validatePlainObject(query, 'query')
      const res = await API.view(designDocName, viewName, query)
      // Assumes the view uses include_docs: true
      // to do without it, just use API.view)
      return mapDoc(res)
    },

    async viewByKeysCustom (viewName, keys, query) {
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      validatePlainObject(query, 'query')
      const res = await API.viewKeys(designDocName, viewName, keys, query)
      return mapDoc(res)
    },

    async viewByKey (viewName, key) {
      validateString(viewName, 'view name')
      validateNonNull(key, 'key')
      return API.viewCustom(viewName, {
        key,
        include_docs: true
      })
    },

    async viewFindOneByKey (viewName, key) {
      validateString(viewName, 'view name')
      validateNonNull(key, 'key')
      const res = await API.viewCustom(viewName, {
        key,
        include_docs: true,
        limit: 1
      })
      const doc = firstDoc(res)
      if (doc) {
        return doc
      } else {
        throw errors_.new('Not Found', 404, [ viewName, key ])
      }
    },

    async viewByKeys (viewName, keys) {
      validateString(viewName, 'view name')
      validateArray(keys, 'keys')
      return API.viewByKeysCustom(viewName, keys, { include_docs: true })
    },
  }
}
