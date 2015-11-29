require 'colors'
Promise = require('bluebird')
Promise.config
  warnings: true
  longStackTraces: true

Promise.onPossiblyUnhandledRejection (err) ->
  console.log 'onPossiblyUnhandledRejection'.red, err
  throw err

Promise::nodeify = (nodeback)->
  @
  .then (value)-> nodeback null, value
  .catch (err)-> nodeback err

exports.serverOpts =
  port: 5984
  hostname: 'localhost'
  user: 'admin'
  pass: 'admin'
exports.dbName = 'test-cot-node'
