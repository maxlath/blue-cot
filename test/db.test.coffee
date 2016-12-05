{ expect } = require 'chai'
Cot = require '../cot.coffee'
config = require './config'

catch404 = (err)->
  if err.statusCode is 404 then return
  else throw err

describe 'DbHandle', ->
  cot = new Cot config.cot
  db = cot.db config.dbName

  beforeEach (done)->
    cot.jsonRequest 'DELETE', "/#{config.dbName}"
    .catch catch404
    .then -> cot.jsonRequest 'PUT', "/#{config.dbName}"
    .then ->
      db.post
        _id: 'person-1'
        type: 'person'
        name: 'Will Conant'
    .then ->
      db.post
        _id: '_design/test'
        views:
          testView:
            map: 'function(d) { emit(d.name, null) }'
    .then -> done()

  describe '#docUrl', ->
    it 'should encode doc ids', (done)->
      encoded = db.docUrl 'foo/bar'
      expect(encoded).to.equal '/test-cot-node/foo%2Fbar'
      done()

    it 'should not encode first slash in design doc ids', (done)->
      encoded = db.docUrl '_design/foo/bar'
      expect(encoded).to.equal '/test-cot-node/_design/foo%2Fbar'
      done()

  describe '#info', ->
    it 'should return database info', (done)->
      db.info()
      .then (info)->
        expect(info).to.be.a 'object'
        expect(info.doc_count).to.equal 2
      .then -> done()

  describe '#get', ->
    it 'should return test document from database', (done)->
      db.get 'person-1'
      .then (doc)->
        expect(doc).to.be.a 'object'
        expect(doc.name).to.equal 'Will Conant'
      .then -> done()

    it 'should return a 404 when a doc is missing', (done)->
      db.get 'missing-doc-id'
      .catch (err)->
        expect(err.statusCode).to.equal 404
        done()

  describe '#view', ->
    it 'should return a single row', (done)->
      db.view 'test', 'testView', {}
      .then (res)->
        expect(res).to.be.object
        expect(res.rows).to.be.array
        expect(res.rows.length).to.equal 1
        expect(res.rows[0].key).to.equal 'Will Conant'
        done()

  describe '#put', ->
    it 'should treat conflicts as expected', (done)->
      doc = { _id: 'put-test' }
      db.put doc
      .then (resp)->
        db.put doc
        .then (res)-> done new Error('should not have resolved')
        .catch (err)->
          expect(err.body.error).to.equal 'conflict'
          done()

  describe '#post', ->
    it 'should treat conflicts as errors', (done)->
      doc = { _id: 'post-test' }
      db.post doc
      .then (res)-> db.post doc
      .then (res)-> done new Error('should not have resolved')
      .catch (err)->
        # got the expected error
        done()

  describe '#batch', ->
    it 'should ignore conflicts', (done)->
      doc = { _id: 'batch-test' }
      origRev = undefined
      db.post doc
      .then (res)->
        origRev = res.rev
        db.batch doc
      .delay(500)
      .then (res)-> db.get doc._id
      .then (res)-> expect(res._rev).to.equal origRev
      .then -> done()

  describe '#exists', ->
    it 'should return true for existing doc', (done)->
      db.exists 'person-1'
      .then (res)->
        expect(res).to.equal true
        done()

    it 'should return false for non-existent doc', (done)->
      db.exists 'does-not-exist'
      .then (res)->
        expect(res).to.equal false
        done()

  describe '#info', ->
    it 'should return the db info', (done)->
      db.info()
      .then (res)->
        expect(res.db_name).to.equal 'test-cot-node'
        done()

  describe '#update', ->
    it 'should apply the passed function to the doc', (done)->
      db.update 'person-1', (doc)->
        doc.b = 2
        return doc
      .then -> db.get 'person-1'
      .then (doc)->
        expect(doc.b).to.equal 2
        done()

    it 'should create the doc if missing', (done)->
      db.update 'does-not-exist', (doc)->
        doc.hello = 123
        return doc
      .then -> db.get 'does-not-exist'
      .then (doc)->
        expect(doc.hello).to.equal 123
        done()
