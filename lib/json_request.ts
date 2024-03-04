import getSessionCookie from './get_session_cookie.js'
import request from './request.js'
import type { Agent } from 'node:http'
import type { FormattedError } from 'types/types.js'

interface JsonRequestParams {
  method: string,
  headers: Record<string, string>,
  agent: Agent,
  attempt: number
  start?: number
  body?: string
}

export function jsonRequestFactory (config) {
  const { host, debug, agent } = config

  // Headers are shared between requests, so that session cookies
  // are re-requested only when needed
  const headers = {
    accept: 'application/json',
    host: config.hostHeader,
  }

  return async function jsonRequest<ResponseBody> (method, path, body) {
    const url = `${host}${path}`
    const params: JsonRequestParams = {
      method,
      headers,
      agent,
      attempt: 1,
    }

    if (debug) params.start = Date.now()

    if (body != null) {
      headers['content-type'] = 'application/json'
      headers['accept-Encoding'] = 'deflate, gzip'
      params.body = JSON.stringify(body)
    }

    return tryRequest<ResponseBody>(url, params, config)
  }
}

const tryRequest = async <ResponseBody>(url, params, config) => {
  const res = await request(url, params)
  return handleResponse<ResponseBody>(res, url, params, config)
}

const handleResponse = async <ResponseBody>(res, url, params, config) => {
  res.data = await res.json() as ResponseBody
  res.statusCode = res.status

  if (config.debug) logRequest(url, params, res)

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

function requestError (res, url, params) {
  const { status, data: body } = res
  const { error, reason } = body
  const err: FormattedError = new Error(`${error}: ${reason}`)
  const { method, attempt } = params
  // Do not include full params object in context
  // as that would params.agent stringification would fail due to circular reference
  // Do not include headers to avoid leaking authentification data
  err.context = { method, url, body, status, attempt }
  err.stack += `\nContext: ${JSON.stringify(err.context)}`
  err.statusCode = err.status = status
  err.body = body
  return err
}

const logRequest = (url, params, res) => {
  const { body, start } = params
  const elapsedTime = Date.now() - start
  const bodyStr = body ? `${body} ` : ''
  console.log(`[blue-cot] ${params.method} ${url} ${bodyStr}- ${res.statusCode} - ${elapsedTime} ms`)
}
