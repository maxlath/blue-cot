const { cot, dbName } = require('config')
const breq = require('bluereq')
const getSessionCookie = require('../lib/get_session_cookie')
const { user, pass, hostname, port } = cot
const host = cot.host = `http://${hostname}:${port}`
global.Promise = require('bluebird')

const dbUrl = `${host}/${dbName}`
const times = 1000

const basicAuthParams = {
  url: dbUrl,
  auth: { user, pass }
}

const createDb = () => {
  return breq.put(basicAuthParams)
  .catch(err => {
    if (err.statusCode !== 412) throw err
  })
}

const basicAuthGet = () => {
  return breq.get(basicAuthParams)
}

const cookieGet = cookie => () => {
  return breq.get({
    url: dbUrl,
    headers: { cookie }
  })
}

const run = (label, fn) => {
  let i = 0
  let chain = Promise.resolve()
  console.time(label)
  while (i++ < times) {
    chain = chain.then(fn)
  }
  return chain.then(() => console.timeEnd(label))
}

createDb()
.then(() => getSessionCookie(cot))
.then(cookie => {
  run(`${times} cookie get`, cookieGet)
  .timeout(5000)
  .then(() => {
    run(`${times} basic auth get`, basicAuthGet)
  })
})
