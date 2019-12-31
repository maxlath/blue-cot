const querystring = require('querystring')
const errors_ = require('./errors')
const { mapDoc } = require('./couch_helpers')
const recover = require('./recover_version')

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
    info: () => {
      return jsonRequest('GET', `/${dbName}`)
      .then(res => res.data)
    },
    get: function (docId, revId) {
      var url = API.docUrl(docId)
      if (typeof revId === 'string') url += `?rev=${revId}`
      return jsonRequest('GET', url)
      .then(function (res) {
        if (res.statusCode !== 200) {
          throw errors_.buildFromRes(res, `error getting doc ${docId}`)
        } else {
          return res.data
        }
      })
    },
    exists: function (docId) {
      return jsonRequest('GET', API.docUrl(docId))
      .then(function (res) {
        if (res.statusCode !== 200) {
          throw errors_.buildFromRes(res, `error getting doc ${docId}`)
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
          return res.data
        } else {
          throw errors_.buildFromRes(res, `error putting doc ${doc._id}`)
        }
      })
    },
    post: function (doc) {
      return jsonRequest('POST', `/${dbName}`, doc)
      .then(function (res) {
        if (res.statusCode === 201) {
          return res.data
        } else if (doc._id) {
          throw errors_.buildFromRes(res, `error posting doc ${doc._id}`)
        } else {
          throw errors_.buildFromRes(res, `error posting new doc`)
        }
      })
    },
    batch: function (doc) {
      const path = `/${dbName}?batch=ok`
      return jsonRequest('POST', path, doc)
      .then(function (res) {
        if (res.statusCode === 202) {
          return res.data
        } else if (doc._id) {
          throw errors_.buildFromRes(res, `error batch posting doc ${doc._id}`)
        } else {
          throw errors_.buildFromRes(res, `error batch posting new doc`)
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
          return res.data
        } else {
          throw errors_.buildFromRes(res, `error deleting doc ${docId}`)
        }
      })
    },
    // Based on http://stackoverflow.com/a/16827094/3324977
    undelete: function (docId) {
      // Verify that it's indeed a deleted document
      return API.get(docId)
      .then(function (res) {
        throw errors_.new("can't undelete an non-deleted document", 400, docId)
      })
      .catch(function (err) {
        if (err.statusCode !== 404 || err.body.reason !== 'deleted') throw err

        var url = API.docUrl(docId) + '?revs=true&open_revs=all'
        return jsonRequest('GET', url)
        .then(function (res) {
          const data = res.data[0].ok
          const currentRev = data._rev
          const preDeleteRevNum = data._revisions.start - 1
          const preDeleteRevId = data._revisions.ids[1]
          const preDeleteRev = preDeleteRevNum + '-' + preDeleteRevId
          return API.get(docId, preDeleteRev)
          .then(function (preDeleteDoc) {
            preDeleteDoc._rev = currentRev
            return API.put(preDeleteDoc)
          })
        })
      })
    },
    bulk: function (docs) {
      const url = `/${dbName}/_bulk_docs`

      // Validate documents to avoid to get a cryptic
      // 'Internal Server Error' 500 CouchDB error
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        if (!isPlainObject(doc)) {
          const err = errors_.new('invalid bulk doc', 400, { doc, index: i })
          return Promise.reject(err)
        }
      }

      return jsonRequest('POST', url, { docs })
      .then(function (res) {
        if (res.statusCode !== 201) {
          throw errors_.buildFromRes(res, `error posting to _bulk_docs`)
        } else {
          for (let i = 0; i < res.data.length; i++) {
            if (res.data[i].error != null) {
              throw errors_.new('bulk response contains errors', 400, res.data)
            }
          }
          return res.data
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
          throw errors_.buildFromRes(res, `error reading view ${path}`)
        } else {
          return res.data
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
          throw errors_.buildFromRes(res, `error reading view ${path}`)
        } else {
          return res.data
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
      .then(res => res.data._revs_info)
    },
    revertLastChange: function (docId) {
      return API.listRevs(docId)
      .then(function (revsInfo) {
        const currentRevInfo = revsInfo[0]
        // Select only the previous one
        const candidatesRevsInfo = revsInfo.slice(1, 2)
        return recover(API, docId, candidatesRevsInfo, currentRevInfo)
      })
    },
    revertToLastVersionWhere: function (docId, testFn) {
      return API.listRevs(docId)
      .then(function (revsInfo) {
        const currentRevInfo = revsInfo[0]
        const candidatesRevsInfo = revsInfo.slice(1)
        return recover(API, docId, candidatesRevsInfo, currentRevInfo, testFn)
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
          throw errors_.buildFromRes(res, `error reading _changes`)
        } else {
          return res.data
        }
      })
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
