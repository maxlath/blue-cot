#
#Copyright (c) 2013 Will Conant, http://willconant.com/
#
#Permission is hereby granted, free of charge, to any person obtaining a copy
#of this software and associated documentation files (the "Software"), to deal
#in the Software without restriction, including without limitation the rights
#to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
#copies of the Software, and to permit persons to whom the Software is
#furnished to do so, subject to the following conditions:
#
#The above copyright notice and this permission notice shall be included in
#all copies or substantial portions of the Software.
#
#THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
#IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
#AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
#OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
#THE SOFTWARE.
#

Cot = (opts) ->
  @port = opts.port
  @hostname = opts.hostname
  @auth = opts.auth
  @ssl = opts.ssl
  @http = (if opts.ssl then require('https') else require('http'))
  @hostHeader = @hostname
  @hostHeader += ':' + @port  if (not @ssl and @port isnt 80) or (@ssl and @port isnt 443)
  return

DbHandle = (cot, name) ->
  @cot = cot
  @name = name
  return

querystring = require 'querystring'
Promise = require 'bluebird'

module.exports = Cot

viewQueryKeys = [
  'descending'
  'endkey'
  'endkey_docid'
  'group'
  'group_level'
  'include_docs'
  'inclusive_end'
  'key'
  'limit'
  'reduce'
  'skip'
  'stale'
  'startkey'
  'startkey_docid'
  'update_seq'
]

changesQueryKeys = [
  'filter'
  'include_docs'
  'limit'
  'since'
  'timeout'
]

Cot:: =
  jsonRequest: (method, path, body) ->
    deferred = Promise.defer()

    headers = {}
    headers['accept'] = 'application/json'
    headers['host'] = @hostHeader
    headers['content-type'] = 'application/json'  if body
    request = @http.request
      hostname: @hostname
      port: @port
      auth: @auth
      path: path
      method: method
      headers: headers

    request.on 'error', deferred.reject.bind(deferred)
    request.on 'res', (res) ->
      res.setEncoding 'utf8'
      buffer = ''
      res.on 'data', (data) ->
        buffer += data
        return

      res.on 'error', deferred.reject.bind(deferred)
      res.on 'end', ->
        myResponse =
          statusCode: res.statusCode
          unparsedBody: buffer

        if res.headers['content-type'] is 'application/json'
          try
            myResponse.body = JSON.parse(buffer)
          catch err
            deferred.reject err
            return
        deferred.resolve myResponse
        return

      return

    if body
      request.end JSON.stringify(body)
    else request.end()
    deferred.promise

  db: (name) -> new DbHandle(this, name)

throwformattedErr = (res, message)->
  err = new Error message
  err.status = res.statusCode
  throw err

DbHandle:: =
  docUrl: (docId) ->
    if typeof docId isnt 'string' or docId.length is 0
      throw new TypeError 'doc id must be a non-empty string'
    if docId.indexOf('_design/') is 0
      '/' + @name + '/_design/' + encodeURIComponent(docId.substr(8))
    else
      '/' + @name + '/' + encodeURIComponent(docId)

  info: ->
    @cot.jsonRequest 'GET', "/#{@name}"
    .then (res) -> res.body


  get: (docId) ->
    @cot.jsonRequest 'GET', @docUrl(docId)
    .then (res) ->
      if res.statusCode isnt 200
        throwformattedErr res, "error getting doc #{docId}: #{res.unparsedBody}"
      else res.body

  exists: (docId) ->
    @cot.jsonRequest 'GET', @docUrl(docId)
    .then (res) ->
      if res.statusCode is 404 then null
      else if res.statusCode isnt 200
        throwformattedErr res, "error getting doc #{docId}: #{res.unparsedBody}"
      else res.body

  put: (doc) ->
    @cot.jsonRequest 'PUT', @docUrl(doc._id), doc
    .then (res) ->
      if res.statusCode in [ 200, 201, 409 ]
        res.body
      else
        throwformattedErr res, "error putting doc #{doc._id}: #{res.unparsedBody}"


  post: (doc) ->
    @cot.jsonRequest 'POST', "/#{@name}", doc
    .then (res) ->
      if res.statusCode is 201 then res.body
      else if doc._id
        throwformattedErr res, "error posting doc #{doc._id}: #{res.unparsedBody}"
      else
        throwformattedErr res, "error posting new doc: #{res.unparsedBody}"

  batch: (doc) ->
    path = "/#{@name}?batch=ok"
    @cot.jsonRequest('POST', path, doc)
    .then (res) ->
      if res.statusCode is 202 then res.body
      else if doc._id
        throwformattedErr res, "error batch posting doc #{doc._id}: #{res.unparsedBody}"
      else
        throwformattedErr res, "error batch posting new doc: #{res.unparsedBody}"


  update: (docId, fn) ->
    tryIt = ->
      db.exists(docId)
      .then (doc) -> fn doc or _id: docId
      .then (doc) -> db.put doc
      .then (res) ->
        if res.ok then res
        else tryIt()

    db = this
    return tryIt()

  delete: (docId, rev) ->
    url = @docUrl(docId) + '?rev=' + encodeURIComponent(rev)
    @cot.jsonRequest('DELETE', url).then (res) ->
      if res.statusCode is 200
        res.body
      else
        throwformattedErr res, "error deleting doc #{docId}: #{res.unparsedBody}"


  bulk: (docs) ->
    url = "/#{@name}/_bulk_docs"
    @cot.jsonRequest 'POST', url, {docs: docs}
    .then (res) ->
      if res.statusCode isnt 201
        throwformattedErr res, "error posting to _bulk_docs: #{res.unparsedBody}"
      else res.body

  buildQueryString: (query)->
    query ||= {}
    q = {}
    viewQueryKeys.forEach (key) ->
      if query[key]?
        if key is 'startkey_docid' or key is 'endkey_docid'
          q[key] = query[key]
        else
          q[key] = JSON.stringify(query[key])
    return querystring.stringify(q)

  viewQuery: (path, query) ->
    qs = @buildQueryString query
    url = "/#{@name}/#{path}?#{qs}"
    @cot.jsonRequest 'GET', url
    .then (res) ->
      if res.statusCode isnt 200
        throwformattedErr res, "error reading view #{path}: #{res.unparsedBody}"
      else res.body


  view: (designName, viewName, query) ->
    @viewQuery "_design/#{designName}/_view/#{viewName}", query

  allDocs: (query) ->
    @viewQuery '_all_docs', query

  viewKeysQuery: (path, keys, query) ->
    qs = @buildQueryString query
    url = "/#{@name}/#{path}?#{qs}"
    @cot.jsonRequest 'POST', url, {keys: keys}
    .then (res) ->
      if res.statusCode isnt 200
        throwformattedErr res, "error reading view #{path}: #{res.unparsedBody}"
      else res.body


  viewKeys: (designName, viewName, keys, query) ->
    path = "_design/#{designName}/_view/#{viewName}"
    @viewKeysQuery path, keys, query

  allDocsKeys: (keys, query) ->
    @viewKeysQuery '_all_docs', keys, query

  changes: (query) ->
    query ||= {}
    q = {}
    changesQueryKeys.forEach (key) ->
      if query[key]?
        q[key] = JSON.stringify(query[key])

    if query.longpoll then q.feed = 'longpoll'
    qs = querystring.stringify(q)
    path = "/#{@name}/_changes?#{qs}"
    @cot.jsonRequest('GET', ).then (res) ->
      if res.statusCode isnt 200
        throwformattedErr res, "error reading _changes: #{res.unparsedBody}"
      else res.body