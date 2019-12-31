// TODO: Reuse connections by reusing http.agent
const fetch = require('node-fetch')
const dbHandle = require('./db_handle')
const addViewFunctions = require('./view_functions')
const getSessionCookie = require('./get_session_cookie')

const configParser = function (opts) {
  const config = {}
  let { protocol, hostname, port, username, password, debug } = opts

  if (!(protocol === 'http' || protocol === 'https')) {
    throw new Error(`invalid protocol: ${protocol}`)
  }

  config.host = `${protocol}://${hostname}:${port}`
  config.username = username
  config.password = password

  config.hostHeader = hostname

  const nonStandardPort = protocol === 'http' ? port !== 80 : port !== 443

  if (nonStandardPort) config.hostHeader += ':' + port

  // Making sure it's a boolean, defaulting to false
  config.debug = debug === true

  return config
}

const JsonRequest = config => {
  const { host, debug } = config

  // Headers are shared between requests, so that session cookies
  // are re-requested only when needed
  const headers = {
    accept: 'application/json',
    host: config.hostHeader
  }

  return async (method, path, body) => {
    const url = `${host}${path}`
    const params = {
      method,
      headers,
      attempt: 1
    }

    if (debug) params.start = Date.now()

    if (body != null) {
      headers['content-type'] = 'application/json'
      params.body = JSON.stringify(body)
    }

    return tryRequest(url, params, config)
  }
}

const tryRequest = async (url, params, config) => {
  const res = await fetch(url, params)
  return handleResponse(res, url, params, config)
}

const handleResponse = async (res, url, params, config) => {
  res.data = await res.json()
  res.statusCode = res.status

  if (config.debug) debug(url, params, res)

  if (res.status < 400) {
    return res
  } else if (res.status === 401 && params.attempt < 3) {
    params.attempt++
    params.headers.cookie = await getSessionCookie(config)
    return tryRequest(url, params, config)
  } else {
    throw requestError(res, url, params)
  }
}

const requestError = (res, url, params) => {
  const { status, data: body } = res
  const { error, reason } = body
  const err = new Error(`${error}: ${reason}`)
  err.context = { url, body, params, status }
  err.stack += `\nContext: ${JSON.stringify(err.context)}`
  err.statusCode = err.status = status
  err.body = body
  return err
}

const debug = (url, params, res) => {
  const { body, start } = params
  const elapsedTime = Date.now() - start
  // Stringify the body to make it copy-pastable for curl
  const bodyStr = body ? (JSON.stringify(body) + ' ') : ''
  console.log(`[blue-cot] ${params.method} ${url} ${bodyStr}- ${res.statusCode} - ${elapsedTime} ms`)
}

module.exports = opts => {
  const jsonRequest = JsonRequest(configParser(opts))
  return (dbName, designDocName) => {
    const API = dbHandle(jsonRequest, dbName)
    if (typeof designDocName === 'string') {
      addViewFunctions(API, designDocName)
    }
    return API
  }
}
