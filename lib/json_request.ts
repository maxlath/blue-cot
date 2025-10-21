import { newError } from './errors.js'
import { getSessionCookie } from './get_session_cookie.js'
import { request } from './request.js'
import { wait } from './utils.js'
import type { Config } from './config_parser.js'
import type { FormattedError } from 'types/types.js'

interface JsonRequestParams {
  method: string
  headers: Record<string, string>
  agent: Config['agent']
  attempt: number
  start?: number
  body?: string
}

export function jsonRequestFactory (config: Config) {
  const { origin, debug, agent } = config

  // Headers are shared between requests, so that session cookies
  // are re-requested only when needed
  const headers = {
    accept: 'application/json',
    host: config.host,
  }

  return async function jsonRequest<ResponseBody> (method: string, path: string, body?) {
    const url = `${origin}${path}`
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

async function tryRequest <ResponseBody> (url, params, config, attempt = 1) {
  try {
    const res = await request(url, params, config)
    return await handleResponse<ResponseBody>(res, url, params, config)
  } catch (err) {
    // - ERR_STREAM_PREMATURE_CLOSE: thrown by node-fetch. It can happen when the maxSockets limit is reached.
    //   Seems to be more likely to happen during the body reception.
    //   See https://github.com/node-fetch/node-fetch/issues/1576#issuecomment-1694418865
    // Should have been patched by https://github.com/inventaire/node-fetch-patched/commit/625fd38
    if (err.code === 'ERR_STREAM_PREMATURE_CLOSE' && attempt < 20) {
      // Generate a better stack trace that what node-fetch returns
      const err2 = newError('json request error', 500, { url, method: params.method, body: params.body })
      err2.cause = err
      if (config.debug || attempt > 1) console.warn(`[blue-cot retrying after ${err.code})]`, err2)
      const delayBeforeRetry = 500 * attempt ** 2
      await wait(delayBeforeRetry)
      return tryRequest(url, params, config, attempt + 1)
    } else {
      throw err
    }
  }
}

async function handleResponse <ResponseBody> (res, url: string, params, config: Config) {
  res.parsedBody = await res.json() as ResponseBody
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
  const { status, parsedBody: body } = res
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

function logRequest (url, params, res) {
  const { body, start } = params
  const elapsedTime = Date.now() - start
  const bodyStr = body ? `${body} ` : ''
  console.log(`[blue-cot] ${params.method} ${url} ${bodyStr}- ${res.statusCode} - ${elapsedTime} ms`)
}
