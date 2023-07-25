const fetch = require('node-fetch')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = (url, options) => tryRequest(url, options)

const tryRequest = async (url, options, attempt = 1) => {
  try {
    return await fetch(url, options)
  } catch (err) {
    // Retry  on 'socket hangup' errors, as this might be due to a persistant connection
    // (agent with keepAlive=true) that was closed because of another error, so retrying
    // should give us access to the primary error
    if (err.code === 'ECONNRESET' && attempt < 20) {
      const delayBeforeRetry = 500 * attempt ** 2
      await sleep(delayBeforeRetry)
      console.warn(`[blue-cot retrying after ECONNRESET (attempt: ${attempt})]`, err)
      return tryRequest(url, options, ++attempt)
    } else {
      throw err
    }
  }
}
