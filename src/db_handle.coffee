querystring = require 'querystring'

module.exports = DbHandle = (cot, name)->
  @cot = cot
  @name = name
  return

DbHandle:: =
  docUrl: (docId)->
    if typeof docId isnt 'string' or docId.length is 0
      throw new TypeError 'doc id must be a non-empty string'
    if docId.indexOf('_design/') is 0
      '/' + @name + '/_design/' + encodeURIComponent(docId.substr(8))
    else
      '/' + @name + '/' + encodeURIComponent(docId)

  info: ->
    @cot.jsonRequest 'GET', "/#{@name}"
    .then (res)-> res.body

  get: (docId)->
    @cot.jsonRequest 'GET', @docUrl(docId)
    .then (res)->
      if res.statusCode isnt 200
        throwformattedErr res, "error getting doc #{docId}"
      else res.body

  exists: (docId)->
    @cot.jsonRequest 'GET', @docUrl(docId)
    .then (res)->
      # TODO: remove error checkers like this 404 one
      # has bluereq now make those response be rejections
      if res.statusCode isnt 200
        throwformattedErr res, "error getting doc #{docId}"
      else true
    .catch (err)->
      if err.statusCode is 404 then false
      else throw err

  put: (doc)->
    @cot.jsonRequest 'PUT', @docUrl(doc._id), doc
    .then (res)->
      if res.statusCode in [ 200, 201 ]
        res.body
      else
        throwformattedErr res, "error putting doc #{doc._id}"


  post: (doc)->
    @cot.jsonRequest 'POST', "/#{@name}", doc
    .then (res)->
      if res.statusCode is 201 then res.body
      else if doc._id
        throwformattedErr res, "error posting doc #{doc._id}"
      else
        throwformattedErr res, "error posting new doc"

  batch: (doc)->
    path = "/#{@name}?batch=ok"
    @cot.jsonRequest('POST', path, doc)
    .then (res)->
      if res.statusCode is 202 then res.body
      else if doc._id
        throwformattedErr res, "error batch posting doc #{doc._id}"
      else
        throwformattedErr res, "error batch posting new doc"

  update: (docId, fn)->
    db = @
    tryIt = ->
      db.get docId
      .catch (err)->
        if err.statusCode is 404 then return { _id: docId }
        else throw err
      .then (doc)-> db.put fn(doc)
      .then (res)->
        if res.ok then res
        else tryIt()

    return tryIt()

  delete: (docId, rev)->
    url = @docUrl(docId) + '?rev=' + encodeURIComponent(rev)
    @cot.jsonRequest('DELETE', url).then (res)->
      if res.statusCode is 200
        res.body
      else
        throwformattedErr res, "error deleting doc #{docId}"


  bulk: (docs)->
    url = "/#{@name}/_bulk_docs"
    @cot.jsonRequest 'POST', url, {docs: docs}
    .then (res)->
      if res.statusCode isnt 201
        throwformattedErr res, "error posting to _bulk_docs"
      else res.body

  buildQueryString: (query)->
    query ||= {}
    q = {}
    viewQueryKeys.forEach (key)->
      if query[key]?
        if key is 'startkey_docid' or key is 'endkey_docid'
          q[key] = query[key]
        else
          q[key] = JSON.stringify(query[key])
    return querystring.stringify(q)

  viewQuery: (path, query)->
    qs = @buildQueryString query
    url = "/#{@name}/#{path}?#{qs}"
    @cot.jsonRequest 'GET', url
    .then (res)->
      if res.statusCode isnt 200
        throwformattedErr res, "error reading view #{path}"
      else res.body


  view: (designName, viewName, query)->
    @viewQuery "_design/#{designName}/_view/#{viewName}", query

  allDocs: (query)->
    @viewQuery '_all_docs', query

  viewKeysQuery: (path, keys, query)->
    qs = @buildQueryString query
    url = "/#{@name}/#{path}?#{qs}"
    @cot.jsonRequest 'POST', url, {keys: keys}
    .then (res)->
      if res.statusCode isnt 200
        throwformattedErr res, "error reading view #{path}"
      else res.body

  viewKeys: (designName, viewName, keys, query)->
    path = "_design/#{designName}/_view/#{viewName}"
    @viewKeysQuery path, keys, query

  allDocsKeys: (keys, query)->
    @viewKeysQuery '_all_docs', keys, query

  changes: (query)->
    query or= {}
    q = {}
    changesQueryKeys.forEach (key)->
      if query[key]? then q[key] = query[key]

    if query.longpoll then q.feed = 'longpoll'
    qs = querystring.stringify q
    path = "/#{@name}/_changes?#{qs}"

    @cot.jsonRequest 'GET', path
    .then (res)->
      if res.statusCode isnt 200
        throwformattedErr res, "error reading _changes"
      else res.body

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
  'descending'
  'heartbeat'
  'style'
  # Not including feed as a possible option as it doesn't play well with promises
  # 'feed'
]

throwformattedErr = (res, message)->
  { statusCode, body } = res
  message += ": #{statusCode}"

  try bodyStr = JSON.stringify body
  catch err
    console.log "couldn't parse body".yellow
    bodyStr = body

  if bodyStr? then message += " - #{bodyStr}"

  err = new Error message
  err.status = res.statusCode
  err.context = res.body
  throw err
