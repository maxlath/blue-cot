const { mapDoc, firstDoc } = require('./couch_helpers')
const errors_ = require('./errors')
const { validateString, validatePlainObject, validateArray, validateNonNull } = require('./utils')

module.exports = (API, designDocName) => ({
  viewCustom: async function (viewName, query) {
    validateString(viewName, 'view name')
    validatePlainObject(query, 'query')
    return API.view(designDocName, viewName, query)
    // Assumes the view uses include_docs: true
    // to do without it, just use API.view)
    .then(mapDoc)
  },
  viewByKeysCustom: async function (viewName, keys, query) {
    validateString(viewName, 'view name')
    validateArray(keys, 'keys')
    validatePlainObject(query, 'query')
    return API.viewKeys(designDocName, viewName, keys, query)
    .then(mapDoc)
  },
  viewByKey: async function (viewName, key) {
    validateString(viewName, 'view name')
    validateNonNull(key, 'key')
    return API.viewCustom(viewName, {
      key,
      include_docs: true
    })
  },
  viewFindOneByKey: async function (viewName, key) {
    validateString(viewName, 'view name')
    validateNonNull(key, 'key')
    return API.viewCustom(viewName, {
      key,
      include_docs: true,
      limit: 1
    })
    .then(firstDoc)
    .then(function (doc) {
      if (doc) {
        return doc
      } else {
        throw errors_.new('Not Found', 404, [ viewName, key ])
      }
    })
  },
  viewByKeys: async function (viewName, keys) {
    validateString(viewName, 'view name')
    validateArray(keys, 'keys')
    return API.viewByKeysCustom(viewName, keys, { include_docs: true })
  }
})
