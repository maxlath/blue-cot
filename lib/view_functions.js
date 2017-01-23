const { mapDoc, firstDoc } = require('./couch_helpers')
const errors_ = require('./errors')

module.exports = function (API, designDocName) {
  return Object.assign(API, {
    designDocName,
    viewCustom: function (viewName, query) {
      return API.view(designDocName, viewName, query)
      // Assumes the view uses include_docs: true
      // to do without it, just use API.view)
      .then(mapDoc)
    },
    viewByKeysCustom: function (viewName, keys, query) {
      return API.viewKeys(designDocName, viewName, keys, query)
      .then(mapDoc)
    },
    viewByKey: function (viewName, key) {
      return API.viewCustom(viewName, {
        key,
        include_docs: true
      })
    },
    viewFindOneByKey: function (viewName, key) {
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
    viewByKeys: function (viewName, keys) {
      return API.viewByKeysCustom(viewName, keys, { include_docs: true })
    }
  })
}
