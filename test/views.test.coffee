{ expect } = require 'chai'
Cot = require '../src/cot.coffee'
config = require './config'
Promise = require 'bluebird'

mapFn = 'function(d) { emit(d.key, null); emit("z", null); }'

describe 'DbHandle', ->
  cot = new Cot config.cot
  db = cot.db config.dbName

  beforeEach (done)->
    cot.jsonRequest 'DELETE', "/#{config.dbName}"
    .then -> cot.jsonRequest 'PUT', "/#{config.dbName}"
    .then ->
      docPromises = []
      i = 1
      while i < 10
        doc =
          _id: "doc-#{i}"
          key: "key-#{i}"
        docPromises.push db.post(doc)
        i++

      designDoc =
        _id: '_design/test'
        views:
          testView:
            map: mapFn
      docPromises.push db.post(designDoc)
      Promise.all docPromises
    .then -> done()

  describe '#view', ->
    it 'should return doc-3 thru doc-6 using startkey_docid and endkey_docid', (done)->
      db.view 'test', 'testView',
        key: 'z'
        startkey_docid: 'doc-3'
        endkey_docid: 'doc-6'
      .then (res)->
        expect(res.rows.length).to.equal 4
        expect(res.rows[0].id).to.equal 'doc-3'
        expect(res.rows[1].id).to.equal 'doc-4'
        expect(res.rows[2].id).to.equal 'doc-5'
        expect(res.rows[3].id).to.equal 'doc-6'
      .then -> done()
