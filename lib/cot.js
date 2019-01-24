const breq = require('bluereq')
const dbHandle = require('./db_handle')
const addViewFunctions = require('./view_functions')
const getSessionCookie = require('./get_session_cookie')

const configParser = function (opts) {
  const config = {}
  let { port, hostname, user, pass, auth, ssl, debug } = opts

  const protocol = ssl ? 'https' : 'http'
  config.host = `${protocol}://${hostname}:${port}`

  // adaptor to assure compatibilty with cot-node interface
  if (auth) {
    [ user, pass ] = auth.split(':')
  }
  config.user = user
  config.pass = pass

  config.hostHeader = hostname

  const notStandardHttpPort = !ssl && port !== 80
  const notStandardHttpsPort = ssl && port !== 443
  if (notStandardHttpPort || notStandardHttpsPort) {
    config.hostHeader += ':' + port
  }

  // Making sure it's a boolean, defaulting to false
  config.debug = debug === true

  return config
}

const JsonRequest = function (config) {
  const { debug, host } = config

  // Default to gzip=false, contrary to bluereq
  const gzip = config.gzip != null ? config.gzip : false

  const headers = {
    accept: 'application/json',
    host: config.hostHeader
  }

  return function (method, path, body) {
    const params = {
      url: `${host}${path}`,
      headers,
      gzip,
      // Include timers in debug mode
      time: debug
    }

    if (body != null) {
      headers['content-type'] = 'application/json'
      params.body = body
    }

    const verb = method.toLowerCase()

    const debugFn = debug ? DebugFn(method, params) : noop

    return breq[verb](params)
    .tap(debugFn)
    .catch(err => {
      debugFn(err)
      if (err.statusCode !== 401) throw err
      return getSessionCookie(config)
      .then(cookie => {
        headers.cookie = cookie
        return breq[verb](params)
        .tap(debugFn)
      })
    })
  }
}

const DebugFn = (method, params) => res => {
  const { body } = params
  // Stringify the body to make it copy-pastable for curl
  const bodyStr = body != null ? (JSON.stringify(body) + ' ') : ''
  console.log(`[blue-cot] ${method} ${params.url} ${bodyStr}- ${res.statusCode} - ${res.elapsedTime} ms`)
}

const noop = () => {}

module.exports = function (opts) {
  const jsonRequest = JsonRequest(configParser(opts))
  return function (dbName, designDocName) {
    const API = dbHandle(jsonRequest, dbName)
    if (typeof designDocName === 'string') {
      addViewFunctions(API, designDocName)
    }
    return API
  }
}
