import { request } from './request.js'
import type { Config } from './config_parser.js'
import type { ErrorResponse } from 'types/types.js'

let sessionCookieRequests = 0

export async function getSessionCookie (config: Config) {
  const { origin, username, password, debug, agent } = config

  if (debug) {
    console.log('session cookie requests', ++sessionCookieRequests)
  }

  const res = await request(`${origin}/_session`, {
    method: 'post',
    headers: {
      'content-type': 'application/json',
      // Required by old CouchDB (ex: v1.6.1)
      Authorization: `Basic ${getBasicCredentials(username, password)}`,
    },
    agent,
    body: JSON.stringify({ name: username, password }),
  }, config)

  if (res.status >= 400) {
    const { error, reason } = (await res.json()) as ErrorResponse
    if (error === 'unauthorized') throw new Error('unauthorized: invalid or missing credentials')
    else throw new Error(`${error}: ${reason}`)
  } else {
    return res.headers.get('set-cookie')
  }
}

function getBasicCredentials (username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString('base64')
}
