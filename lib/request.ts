import fetch from 'node-fetch'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export default (url, options) => tryRequest(url, options)

const tryRequest = async (url, options, attempt = 1) => {
  try {
    return await fetch(url, options)
  } catch (err) {
    // Retry on
    // - ECONNRESET aka 'socket hangup' errors, as this might be due to a persistant connection
    //   (agent with keepAlive=true) that was closed because of another error, so retrying
    //   should give us access to the primary error
    // - ERR_STREAM_PREMATURE_CLOSE: thrown by node-fetch. It can happen when the maxSockets limit is reached.
    //   See https://github.com/node-fetch/node-fetch/issues/1576#issuecomment-1694418865
    if ((err.code === 'ECONNRESET' || err.code === 'ERR_STREAM_PREMATURE_CLOSE') && attempt < 20) {
      const delayBeforeRetry = 500 * attempt ** 2
      await sleep(delayBeforeRetry)
      console.warn(`[blue-cot retrying after ${err.code} (attempt: ${attempt})]`, err)
      return tryRequest(url, options, ++attempt)
    } else {
      throw err
    }
  }
}
