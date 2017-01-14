module.exports = function (res, message) {
  const { statusCode, body } = res
  message += `: ${statusCode}`

  var bodyStr
  try {
    bodyStr = JSON.stringify(body)
  } catch (err) {
    console.log("couldn't parse body")
    bodyStr = body
  }

  if (bodyStr) message += ` - ${bodyStr}`

  const err = new Error(message)
  err.status = res.statusCode
  err.context = res.body
  return err
}
