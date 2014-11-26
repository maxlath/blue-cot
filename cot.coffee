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
    request.on 'response', (response) ->
      response.setEncoding 'utf8'
      buffer = ''
      response.on 'data', (data) ->
        buffer += data
        return

      response.on 'error', deferred.reject.bind(deferred)
      response.on 'end', ->
        myResponse =
          statusCode: response.statusCode
          unparsedBody: buffer

        if response.headers['content-type'] is 'application/json'
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
    .then (response) -> response.body


  get: (docId) ->
    @cot.jsonRequest 'GET', @docUrl(docId)
    .then (response) ->
      if response.statusCode isnt 200
        err = "error getting doc #{docId}: #{response.unparsedBody}"
        throw new Error err
      else response.body

  exists: (docId) ->
    @cot.jsonRequest 'GET', @docUrl(docId)
    .then (response) ->
      if response.statusCode is 404 then null
      else if response.statusCode isnt 200
        err = "error getting doc #{docId}: #{response.unparsedBody}"
        throw new Error err
      else response.body

  put: (doc) ->
    @cot.jsonRequest 'PUT', @docUrl(doc._id), doc
    .then (response) ->
      if response.statusCode is 201 or response.statusCode is 409
        response.body
      else
        err = "error putting doc #{doc._id}: #{response.unparsedBody}"
        throw new Error err


  post: (doc) ->
    @cot.jsonRequest 'POST', "/#{@name}", doc
    .then (response) ->
      if response.statusCode is 201 then response.body
      else if doc._id
        err = "error posting doc #{doc._id}: #{response.unparsedBody}"
        throw new Error err
      else
        throw new Error "error posting new doc: #{response.unparsedBody}"

  batch: (doc) ->
    path = "/#{@name}?batch=ok"
    @cot.jsonRequest('POST', path, doc)
    .then (response) ->
      if response.statusCode is 202 then response.body
      else if doc._id
        err = "error batch posting doc #{doc._id}: #{response.unparsedBody}"
        throw new Error err
      else
        throw new Error "error batch posting new doc: #{response.unparsedBody}"


  update: (docId, fn) ->
    tryIt = ->
      db.exists(docId)
      .then (doc) -> fn doc or _id: docId
      .then (doc) -> db.put doc
      .then (response) ->
        if response.ok then response
        else tryIt()

    db = this
    return tryIt()

  delete: (docId, rev) ->
    url = @docUrl(docId) + '?rev=' + encodeURIComponent(rev)
    @cot.jsonRequest('DELETE', url).then (response) ->
      if response.statusCode is 200
        response.body
      else
        err = "error deleting doc #{docId}: #{response.unparsedBody}"
        throw new Error err


  bulk: (docs) ->
    url = "/#{@name}/_bulk_docs"
    @cot.jsonRequest 'POST', url, {docs: docs}
    .then (response) ->
      if response.statusCode isnt 201
        throw new Error "error posting to _bulk_docs: #{response.unparsedBody}"
      else response.body

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
    .then (response) ->
      if response.statusCode isnt 200
        err = "error reading view #{path}: #{response.unparsedBody}"
        throw new Error err
      else response.body


  view: (designName, viewName, query) ->
    @viewQuery "_design/#{designName}/_view/#{viewName}", query

  allDocs: (query) ->
    @viewQuery '_all_docs', query

  viewKeysQuery: (path, keys, query) ->
    qs = @buildQueryString query
    url = "/#{@name}/#{path}?#{qs}"
    @cot.jsonRequest 'POST', url, {keys: keys}
    .then (response) ->
      if response.statusCode isnt 200
        err = "error reading view #{path}: #{response.unparsedBody}"
        throw new Error err
      else response.body


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
    @cot.jsonRequest('GET', ).then (response) ->
      if response.statusCode isnt 200
        throw new Error "error reading _changes: #{response.unparsedBody}"
      else response.body