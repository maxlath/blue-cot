import type { FormattedError } from 'types/types.js'

function formatError (message, statusCode, context) {
  const err: FormattedError = new Error(message)
  if (statusCode) err.statusCode = statusCode
  if (context) err.context = context
  return err
}

const buildFromRes = function (res, message) {
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

  return formatError(message, statusCode, body)
}

export default { new: formatError, buildFromRes }
