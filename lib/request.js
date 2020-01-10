const fetch = require('node-fetch')

module.exports = (url, options) => {
  return fetch(url, options)
  .catch(err => {
    // Retry once on 'socket hangup' errors, as this might be due to a persistant connection
    // (agent with keepAlive=true) that was closed because of another error, so retrying
    // should give us access to the primary error
    if (err.code === 'ECONNRESET') return fetch(url, options)
    else throw err
  })
}
