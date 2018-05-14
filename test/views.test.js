const should = require('should')
const cot = require('../lib/cot')
const config = require('./config')
global.Promise = require('bluebird')

const mapFn = 'function(d) { emit(d.key, null); emit("z", null); }'

describe('Views', function () {
  const db = cot(config.cot)(config.dbName, 'test')

  beforeEach(function (done) {
    db.jsonRequest('DELETE', `/${config.dbName}`)
    .then(() => db.jsonRequest('PUT', `/${config.dbName}`))
    .then(function () {
      const docPromises = []
      let i = 1
      while (i < 10) {
        let doc = {
          _id: `doc-${i}`,
          key: `key-${i}`
        }
        docPromises.push(db.post(doc))
        i++
      }

      const designDoc = {
        _id: '_design/test',
        views: {
          testView: {
            map: mapFn
          }
        }
      }

      docPromises.push(db.post(designDoc))

      Promise.all(docPromises)
      .then(() => done())
    })
  })

  describe('#view', function () {
    it('should return doc-3 thru doc-6 using startkey_docid and endkey_docid', function (done) {
      db.view('test', 'testView', {
        key: 'z',
        startkey_docid: 'doc-3',
        endkey_docid: 'doc-6'
      })
      .then(function (res) {
        res.rows.length.should.equal(4)
        res.rows[0].id.should.equal('doc-3')
        res.rows[1].id.should.equal('doc-4')
        res.rows[2].id.should.equal('doc-5')
        res.rows[3].id.should.equal('doc-6')
      })
      .then(() => done())
    })
  })

  describe('#viewFindOneByKey', function () {
    it('should return a unique doc', function (done) {
      db.viewFindOneByKey('testView', 'key-1')
      .then(function (doc) {
        doc._id.should.equal('doc-1')
        done()
      })
    })

    it('should return a formatted error', function (done) {
      db.viewFindOneByKey('testView', 'notexisting')
      .catch(function (err) {
        should(err.statusCode).be.ok()
        should(err.context).be.ok()
        done()
      })
    })
  })
})
