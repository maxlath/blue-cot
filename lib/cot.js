const breq = require('bluereq')
const dbHandle = require('./db_handle')
const addViewFunctions = require('./view_functions')

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
  const headers = {
    accept: 'application/json',
    host: config.hostHeader
  }

  return function (method, path, body) {
    const params = {
      url: `${host}${path}`,
      headers
    }

    if (body != null) {
      headers['content-type'] = 'application/json'
      params.body = body
    }

    if (debug) {
      // stringify the body to make it copy-pastable for curl
      const bodyStr = JSON.stringify(body) || ''
      console.log('[bluecot debug]', method, params.url, bodyStr)
    }

    const verb = method.toLowerCase()

    return breq[verb](params)
    .catch(err => {
      if (err.statusCode !== 401) throw err
      return getSessionCookie(config)
      .then(cookie => {
        headers.cookie = cookie
        return breq[verb](params)
      })
    })
  }
}

let sessionCookieRequests = 0

const getSessionCookie = function (config) {
  const { host, user, pass, debug } = config

  if (debug) {
    console.log('session cookie requests', ++sessionCookieRequests)
  }

  return breq.post({
    url: `${host}/_session`,
    body: { name: user, password: pass }
  })
  .then(res => res.headers['set-cookie'][0])
}

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
