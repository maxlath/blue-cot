const should = require('should')
const cot = require('../lib/cot')
const config = require('config')
const { shouldNotBeCalled } = require('./utils')

describe('Views', function () {
  const db = cot(config.cot)(config.dbName, 'test')

  beforeEach(async function () {
    await db.request('DELETE', `/${config.dbName}`)
    await db.request('PUT', `/${config.dbName}`)

    const docPromises = []
    let i = 1
    while (i < 10) {
      const doc = {
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
          map: 'function (doc) { emit("z", null) }'
        },
        byKey: {
          map: 'function (doc) { emit(doc.key, null) }'
        }
      }
    }

    docPromises.push(db.post(designDoc))

    await Promise.all(docPromises)
  })

  describe('#view', function () {
    it('should return doc-3 thru doc-6 using startkey_docid and endkey_docid', async function () {
      const res = await db.view('test', 'testView', {
        key: 'z',
        startkey_docid: 'doc-3',
        endkey_docid: 'doc-6'
      })
      res.rows.length.should.equal(4)
      res.rows[0].id.should.equal('doc-3')
      res.rows[1].id.should.equal('doc-4')
      res.rows[2].id.should.equal('doc-5')
      res.rows[3].id.should.equal('doc-6')
    })

    it('should return rows by keys', async function () {
      const res = await db.view('test', 'byKey', {
        keys: [ 'key-2', 'key-3' ],
      })
      res.rows.length.should.equal(2)
      res.rows[0].id.should.equal('doc-2')
      res.rows[1].id.should.equal('doc-3')
    })
  })

  describe('#viewFindOneByKey', function () {
    it('should return a unique doc', async function () {
      const doc = await db.viewFindOneByKey('byKey', 'key-1')
      doc._id.should.equal('doc-1')
    })

    it('should return a formatted error', async function () {
      await db.viewFindOneByKey('testView', 'notexisting')
      .then(shouldNotBeCalled)
      .catch(err => {
        should(err.statusCode).be.ok()
        should(err.context).be.ok()
      })
    })
  })
})
