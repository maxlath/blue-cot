import fetch from 'node-fetch'
import { newError } from './errors.js'
import { wait } from './utils.js'

export default (url, options) => tryRequest(url, options)

const retryableErrors = [
  // aka 'socket hangup' errors, as this might be due to a persistant connection
  // (agent with keepAlive=true) that was closed because of another error, so retrying
  // should give us access to the primary error
  'ECONNRESET',
  // Thrown by node-fetch. It can happen when the maxSockets limit is reached.
  // See https://github.com/node-fetch/node-fetch/issues/1576#issuecomment-1694418865
  'ERR_STREAM_PREMATURE_CLOSE',
  'HPE_INVALID_CHUNK_SIZE',
  'EPIPE',
] as const

async function tryRequest (url, options, attempt = 1) {
  try {
    return await fetch(url, options)
  } catch (err) {
    // Generate a better stack trace that what node-fetch returns
    const err2 = newError('blue-cot request error', 500, { url, method: options.method, body: options.body, attempt })
    err2.cause = err
    if ((retryableErrors.includes(err.code)) && attempt < 20) {
      const delayBeforeRetry = 500 * attempt ** 2
      await wait(delayBeforeRetry)
      console.warn(`[blue-cot retrying after ${err.code} (attempt: ${attempt})]`, err)
      return tryRequest(url, options, ++attempt)
    } else {
      throw err2
    }
  }
}
