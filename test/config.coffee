module.exports = require 'config'

Promise = require 'bluebird'
Promise.config
  warnings: true
  longStackTraces: true

Promise.onPossiblyUnhandledRejection (err) ->
  console.log 'onPossiblyUnhandledRejection', err
  throw err
