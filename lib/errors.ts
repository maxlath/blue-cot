import type { FormattedError } from 'types/types.js'

export function newError (message, statusCode, context) {
  const err: FormattedError = new Error(message)
  if (statusCode) err.statusCode = statusCode
  if (context) err.context = context
  return err
}

export function buildErrorFromRes (res, message) {
  const { statusCode, body } = res
  message += `: ${statusCode}`

  let bodyStr
  try {
    bodyStr = JSON.stringify(body)
  } catch (err) {
    console.log("couldn't parse body")
    bodyStr = body
  }

  if (bodyStr) message += ` - ${bodyStr}`

  return newError(message, statusCode, body)
}
