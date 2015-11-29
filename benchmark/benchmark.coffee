Benchmark = require 'benchmark'
suite = new Benchmark.Suite

config = require '../test/config'

Cot = require 'cot'
BlueCot = require '..'

cot = new Cot config.serverOpts
bluecot = new BlueCot config.serverOpts

db1 = cot.db config.dbName
db2 = bluecot.db config.dbName

data = JSON.parse require('fs').readFileSync './package.json', 'utf-8'

getDoc = ->
  _id: 'person-' + Math.random()
  type: 'person'
  name: 'Georges'
  data: data

post = (db)->
  doc = getDoc()
  db.post doc
  .then (res)-> db.get doc._id
  .then (res)-> db.post doc
  .catch (err)->
    # conflict err
    return


suite
.add 'cot', -> post db1
.add 'blue-cot', -> post db1
.on 'cycle', (event) -> console.log String(event.target)
.on 'complete', -> console.log 'Fastest is ' + @filter('fastest').pluck('name')
.run { async: true }
