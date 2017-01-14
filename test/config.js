module.exports = require('config')

global.Promise = require('bluebird')
Promise.config({
  warnings: false,
  longStackTraces: true
})

Promise.onPossiblyUnhandledRejection(function (err) {
  console.log('onPossiblyUnhandledRejection', err)
  throw err
})
