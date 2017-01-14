const breq = require('bluereq')
const dbHandle = require('./db_handle')

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

  var auth
  if (config.user && config.pass) {
    auth = {
      user: config.user,
      pass: config.pass
    }
  }

  return function (method, path, body) {
    const params = {
      url: `${host}${path}`,
      headers,
      auth
    }

    if (body != null) {
      headers['content-type'] = 'application/json'
      params.body = body
    }

    if (debug) {
      // stringify the body to make it copy-pastable for curl
      const bodyStr = JSON.stringify(body) || ''
      console.log('[cot debug] jsonRequest\n', method, params.url, bodyStr)
    }

    const verb = method.toLowerCase()

    return breq[verb](params)
  }
}

module.exports = function (opts) {
  const jsonRequest = JsonRequest(configParser(opts))
  return (dbName) => dbHandle(jsonRequest, dbName)
}
