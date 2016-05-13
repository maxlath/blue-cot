chai = require 'chai'
expect = chai.expect
Cot = require '../cot.coffee'
config = require './config'

describe 'Cot', ->
  it 'should include port in host header when port not default for protocol', ->
    c1 = new Cot
      port: 80
      hostname: 'foo'
    expect(c1.hostHeader).to.equal 'foo'
    c2 = new Cot
      port: 8080
      hostname: 'foo'
    expect(c2.hostHeader).to.equal 'foo:8080'
    c3 = new Cot
      port: 443
      hostname: 'foo'
      ssl: true
    expect(c3.hostHeader).to.equal 'foo'
    c4 = new Cot
      port: 8080
      hostname: 'foo'
      ssl: true
    expect(c4.hostHeader).to.equal 'foo:8080'

catch404 = (err)->
  if err.statusCode is 404 then return
  else throw err

describe 'DbHandle', ->
  cot = new Cot config.serverOpts
  db = cot.db config.dbName

  beforeEach (done)->
    cot.jsonRequest 'DELETE', '/' + config.dbName
    .catch catch404
    .then -> cot.jsonRequest 'PUT', '/' + config.dbName
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
      encoded = db.docUrl('foo/bar')
      expect(encoded).to.equal '/test-cot-node/foo%2Fbar'
      done()

    it 'should not encode first slash in design doc ids', (done)->
      encoded = db.docUrl('_design/foo/bar')
      expect(encoded).to.equal '/test-cot-node/_design/foo%2Fbar'
      done()

  describe '#info', ->
    it 'should return database info', (done)->
      db.info().then (info)->
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

  describe '#view', ->
    it 'should return a single row', (done)->
      db.view 'test', 'testView', {}
      .then (response)->
        expect(response).to.be.object
        expect(response.rows).to.be.array
        expect(response.rows.length).to.equal 1
        expect(response.rows[0].key).to.equal 'Will Conant'
        done()

  describe '#put', ->
    it 'should treat conflicts as expected', (done)->
      doc = _id: 'put-test'
      db.put doc
      .then (resp)->
        db.put doc
        .catch (err)->
          expect(err.body.error).to.equal 'conflict'
          done()

  describe '#post', ->
    it 'should treat conflicts as errors', (done)->
      doc = _id: 'post-test'
      db.post doc
      .then (response)-> db.post doc
      .then (response)-> done new Error('should not have resolved')
      .catch (err)->
        # got the expected error
        done()

  describe '#batch', ->
    it 'should ignore conflicts', (done)->
      doc = _id: 'batch-test'
      origRev = undefined
      db.post doc
      .then (response)->
        origRev = response.rev
        db.batch doc
      .delay(500)
      .then (response)-> db.get doc._id
      .then (response)-> expect(response._rev).to.equal origRev
      .then -> done()

  describe '#exists', ->
    it 'should return null for nonexistent doc', (done)->
      db.exists 'does-not-exist'
      .catch (err)->
        expect(err.statusCode).to.equal 404
        done()
