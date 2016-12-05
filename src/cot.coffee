breq = require 'bluereq'
DbHandle = require './db_handle'

module.exports = Cot = (opts)->
  { port, hostname, user, pass, auth, ssl, hostname, debug } = opts

  protocol = if ssl then 'https' else 'http'
  @host = "#{protocol}://#{hostname}:#{port}"

  # adaptor to assure compatibilty with cot-node interface
  if auth? then [ user, pass ] = auth.split ':'
  @user = user
  @pass = pass

  @hostHeader = hostname

  notStandardHttpPort = not ssl and port isnt 80
  notStandardHttpsPort = ssl and port isnt 443
  if notStandardHttpPort or notStandardHttpsPort
    @hostHeader += ':' + port

  # Making sure it's a boolean, defaulting to false
  @debug = debug is true

  return

Cot:: =
  jsonRequest: (method, path, body)->
    headers =
      accept: 'application/json'
      host: @hostHeader

    params =
      url: "#{@host}#{path}"
      headers: headers

    if body?
      headers['content-type'] = 'application/json'
      params.body = body

    if @debug
      # stringify the body to make it copy-pastable for curl
      bodyStr = JSON.stringify(body) or ''
      console.log '[cot debug] jsonRequest\n', method, params.url, bodyStr

    if @user? and @pass?
      params.auth =
        user: @user
        pass: @pass

    verb = method.toLowerCase()

    return breq[verb](params)

  db: (name)-> new DbHandle(this, name)
