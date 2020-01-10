const fetch = require('node-fetch')
let sessionCookieRequests = 0

module.exports = async config => {
  const { host, username, password, debug, agent } = config

  if (debug) {
    console.log('session cookie requests', ++sessionCookieRequests)
  }

  const res = await fetch(`${host}/_session`, {
    method: 'post',
    headers: {
      'content-type': 'application/json',
      // Required by old CouchDB (ex: v1.6.1)
      'Authorization': `Basic ${getBasicCredentials(username, password)}`
    },
    agent,
    body: JSON.stringify({ name: username, password })
  })

  if (res.status >= 400) {
    const { error, reason } = await res.json()
    throw new Error(`${error}: ${reason}`)
  } else {
    return res.headers.get('set-cookie')
  }
}

const getBasicCredentials = (username, password) => {
  return Buffer.from(`${username}:${password}`).toString('base64')
}
