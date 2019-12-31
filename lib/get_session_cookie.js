const fetch = require('node-fetch')
let sessionCookieRequests = 0

module.exports = async config => {
  const { host, user, pass, debug } = config

  if (debug) {
    console.log('session cookie requests', ++sessionCookieRequests)
  }

  const res = await fetch(`${host}/_session`, {
    method: 'post',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ name: user, password: pass })
  })

  if (res.status >= 400) {
    const { error, reason } = await res.json()
    throw new Error(`${error}: ${reason}`)
  } else {
    return res.headers.get('set-cookie')
  }
}
