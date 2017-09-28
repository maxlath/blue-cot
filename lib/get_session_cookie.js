const breq = require('bluereq')
let sessionCookieRequests = 0

module.exports = function (config) {
  const { host, user, pass, debug } = config

  if (debug) {
    console.log('session cookie requests', ++sessionCookieRequests)
  }
  return breq.post({
    url: `${host}/_session`,
    // The request itself should be authentified
    auth: { user, pass },
    body: { name: user, password: pass }
  })
  .then(res => res.headers['set-cookie'][0])
}
