const querystring = require('querystring')
const formattedErr = require('./format_error')
const { mapDoc } = require('./couch_helpers')

module.exports = function (jsonRequest, dbName) {
  const API = {
    docUrl: function (docId) {
      if (typeof docId !== 'string' || docId.length === 0) {
        throw new TypeError('doc id must be a non-empty string')
      }
      if (docId.indexOf('_design/') === 0) {
        return '/' + dbName + '/_design/' + encodeURIComponent(docId.substr(8))
      } else {
        return '/' + dbName + '/' + encodeURIComponent(docId)
      }
    },
    info: function () {
      return jsonRequest('GET', `/${dbName}`)
      .then(res => res.body)
    },
    get: function (docId, revId) {
      var url = API.docUrl(docId)
      if (typeof revId === 'string') url += `?rev=${revId}`
      return jsonRequest('GET', url)
      .then(function (res) {
        if (res.statusCode !== 200) {
          throw formattedErr(res, `error getting doc ${docId}`)
        } else {
          return res.body
        }
      })
    },
    exists: function (docId) {
      return jsonRequest('GET', API.docUrl(docId))
      .then(function (res) {
        // TODO: remove error checkers like API 404 one
        // has bluereq now make those response be rejections
        if (res.statusCode !== 200) {
          throw formattedErr(res, `error getting doc ${docId}`)
        } else {
          return true
        }
      })
      .catch(function (err) {
        if (err.statusCode === 404) {
          return false
        } else {
          throw err
        }
      })
    },
    put: function (doc) {
      return jsonRequest('PUT', API.docUrl(doc._id), doc)
      .then(function (res) {
        if ([ 200, 201 ].includes(res.statusCode)) {
          return res.body
        } else {
          throw formattedErr(res, `error putting doc ${doc._id}`)
        }
      })
    },
    post: function (doc) {
      return jsonRequest('POST', `/${dbName}`, doc)
      .then(function (res) {
        if (res.statusCode === 201) {
          return res.body
        } else if (doc._id) {
          throw formattedErr(res, `error posting doc ${doc._id}`)
        } else {
          throw formattedErr(res, `error posting new doc`)
        }
      })
    },
    batch: function (doc) {
      const path = `/${dbName}?batch=ok`
      return jsonRequest('POST', path, doc)
      .then(function (res) {
        if (res.statusCode === 202) {
          return res.body
        } else if (doc._id) {
          throw formattedErr(res, `error batch posting doc ${doc._id}`)
        } else {
          throw formattedErr(res, `error batch posting new doc`)
        }
      })
    },
    update: function (docId, fn) {
      const db = API
      const tryIt = function () {
        return db.get(docId)
        .catch(function (err) {
          if (err.statusCode === 404) {
            return { _id: docId }
          } else {
            throw err
          }
        })
        .then(doc => db.put(fn(doc)))
        .then(function (res) {
          if (res.ok) {
            return res
          } else {
            return tryIt()
          }
        })
      }
      return tryIt()
    },
    delete: function (docId, rev) {
      const url = API.docUrl(docId) + '?rev=' + encodeURIComponent(rev)
      return jsonRequest('DELETE', url)
      .then(function (res) {
        if (res.statusCode === 200) {
          return res.body
        } else {
          throw formattedErr(res, `error deleting doc ${docId}`)
        }
      })
    },
    bulk: function (docs) {
      const url = `/${dbName}/_bulk_docs`
      return jsonRequest('POST', url, { docs })
      .then(function (res) {
        if (res.statusCode !== 201) {
          throw formattedErr(res, `error posting to _bulk_docs`)
        } else {
          return res.body
        }
      })
    },
    buildQueryString: function (query = {}) {
      const q = {}
      viewQueryKeys.forEach(function (key) {
        if (query[key] != null) {
          if (key === 'startkey_docid' || key === 'endkey_docid') {
            q[key] = query[key]
          } else {
            q[key] = JSON.stringify(query[key])
          }
        }
      })
      return querystring.stringify(q)
    },
    viewQuery: function (path, query) {
      const qs = API.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      return jsonRequest('GET', url)
      .then(function (res) {
        if (res.statusCode !== 200) {
          throw formattedErr(res, `error reading view ${path}`)
        } else {
          return res.body
        }
      })
    },
    view: function (designName, viewName, query) {
      return API.viewQuery(`_design/${designName}/_view/${viewName}`, query)
    },
    allDocs: function (query) {
      return API.viewQuery('_all_docs', query)
    },
    viewKeysQuery: function (path, keys, query) {
      const qs = API.buildQueryString(query)
      const url = `/${dbName}/${path}?${qs}`
      return jsonRequest('POST', url, { keys })
      .then(function (res) {
        if (res.statusCode !== 200) {
          throw formattedErr(res, `error reading view ${path}`)
        } else {
          return res.body
        }
      })
    },
    viewKeys: function (designName, viewName, keys, query) {
      const path = `_design/${designName}/_view/${viewName}`
      return API.viewKeysQuery(path, keys, query)
    },
    // http://docs.couchdb.org/en/latest/api/database/bulk-api.html#post--db-_all_docs
    allDocsKeys: function (keys, query) {
      return API.viewKeysQuery('_all_docs', keys, query)
    },
    fetch: function (keys) {
      return API.viewKeysQuery('_all_docs', keys, { include_docs: true })
      .then(mapDoc)
    },
    listRevs: function (docId) {
      const url = API.docUrl(docId) + '?revs_info=true'
      return jsonRequest('GET', url)
      .then(res => res.body._revs_info)
    },
    revertLastChange: function (docId) {
      return API.listRevs(docId)
      .then(function (revsInfo) {
        const currentRevInfo = revsInfo[0]
        const previousRevInfo = revsInfo[1]
        if (previousRevInfo == null) {
          const err = new Error('no previous version could be found')
          err.statusCode = 400
          err.context = { doc: docId }
          throw err
        }
        if (previousRevInfo.status !== 'available') {
          const err = new Error('previous version isnt available')
          err.statusCode = 400
          err.context = { doc: docId, rev_info: previousRevInfo }
          throw err
        }
        return API.get(docId, previousRevInfo.rev)
        .then(function (lastVersion) {
          lastVersion._rev = currentRevInfo.rev
          return API.put(lastVersion)
        })
      })
    },
    changes: function (query = {}) {
      const q = {}
      changesQueryKeys.forEach(function (key) {
        if (query[key] != null) q[key] = query[key]
      })
      if (query.longpoll) q.feed = 'longpoll'
      const qs = querystring.stringify(q)
      const path = `/${dbName}/_changes?${qs}`

      return jsonRequest('GET', path)
      .then(function (res) {
        if (res.statusCode !== 200) {
          throw formattedErr(res, `error reading _changes`)
        } else {
          return res.body
        }
      })
    }
  }
  API.name = dbName
  API.jsonRequest = jsonRequest
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
