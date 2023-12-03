import request from './request.js'
let sessionCookieRequests = 0

export default async config => {
  const { host, username, password, debug, agent } = config

  if (debug) {
    console.log('session cookie requests', ++sessionCookieRequests)
  }

  const res = await request(`${host}/_session`, {
    method: 'post',
    headers: {
      'content-type': 'application/json',
      // Required by old CouchDB (ex: v1.6.1)
      Authorization: `Basic ${getBasicCredentials(username, password)}`
    },
    agent,
    body: JSON.stringify({ name: username, password })
  })

  if (res.status >= 400) {
    const { error, reason } = await res.json()
    if (error === 'unauthorized') throw new Error('unauthorized: invalid or missing credentials')
    else throw new Error(`${error}: ${reason}`)
  } else {
    return res.headers.get('set-cookie')
  }
}

const getBasicCredentials = (username, password) => {
  return Buffer.from(`${username}:${password}`).toString('base64')
}
