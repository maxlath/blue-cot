require 'colors'
Promise = require('bluebird')
Promise.config
  warnings: true
  longStackTraces: true

Promise.onPossiblyUnhandledRejection (err) ->
  console.log 'onPossiblyUnhandledRejection'.red, err
  throw err

exports.serverOpts =
  port: 5984
  hostname: 'localhost'
  user: 'admin'
  pass: 'admin'
  # debug: true
exports.dbName = 'test-cot-node'
