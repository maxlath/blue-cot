import config from 'config'
import should from 'should'
import cot from '../dist/lib/cot.js'
import { shouldNotBeCalled, catch404 } from './utils.js'

describe('Validations', () => {
  const db = cot(config.cot)(config.dbName, 'test')

  describe('#getDocsByViewQuery', () => {
    it('should reject a call without a view name', async () => {
      await db.getDocsByViewQuery()
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid view name')
      })
    })

    it('should reject a call without query object', async () => {
      await db.getDocsByViewQuery('byKey')
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid query object')
      })
    })
  })

  describe('#getDocsByViewKeysAndCustomQuery', () => {
    it('should reject a call without a view name', async () => {
      await db.getDocsByViewKeysAndCustomQuery()
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid view name')
      })
    })

    it('should reject a call without a keys array', async () => {
      await db.getDocsByViewKeysAndCustomQuery('byKey')
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid keys array')
      })
    })

    it('should reject a call without query object', async () => {
      await db.getDocsByViewKeysAndCustomQuery('byKey', [ 'foo' ])
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid query object')
      })
    })
  })

  describe('#getDocsByViewKey', () => {
    it('should reject a call without a view name', async () => {
      await db.getDocsByViewKey()
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid view name')
      })
    })

    it('should reject a call without a key', async () => {
      await db.getDocsByViewKey('byKey')
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.equal('missing key')
      })
    })
  })

  describe('#findDocByViewKey', () => {
    it('should reject a call without a view name', async () => {
      await db.findDocByViewKey()
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid view name')
      })
    })

    it('should reject a call without a key', async () => {
      await db.findDocByViewKey('byKey')
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.equal('missing key')
      })
    })
  })

  describe('#getDocsByViewKeys', () => {
    it('should reject a call without a view name', async () => {
      await db.getDocsByViewKeys()
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid view name')
      })
    })

    it('should reject a call without keys array', async () => {
      await db.getDocsByViewKeys('byKey')
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.startWith('invalid keys array')
      })
    })
  })
})

describe('Views', () => {
  const db = cot(config.cot)(config.dbName, 'test')

  beforeEach(async () => {
    await db.request('DELETE', `/${config.dbName}`).catch(catch404)
    await db.request('PUT', `/${config.dbName}`)

    const docPromises = []
    let i = 1
    while (i < 10) {
      const doc = {
        _id: `doc-${i}`,
        key: `key-${i}`,
      }
      docPromises.push(db.post(doc))
      i++
    }

    const designDoc = {
      _id: '_design/test',
      views: {
        testView: {
          map: 'function (doc) { emit("z", null) }',
        },
        byKey: {
          map: 'function (doc) { emit(doc.key, null) }',
        },
      },
    }

    docPromises.push(db.post(designDoc))

    await Promise.all(docPromises)
  })

  describe('#view', () => {
    it('should return doc-3 thru doc-6 using startkey_docid and endkey_docid', async () => {
      const res = await db.view('test', 'testView', {
        key: 'z',
        startkey_docid: 'doc-3',
        endkey_docid: 'doc-6',
      })
      res.rows.length.should.equal(4)
      res.rows[0].id.should.equal('doc-3')
      res.rows[1].id.should.equal('doc-4')
      res.rows[2].id.should.equal('doc-5')
      res.rows[3].id.should.equal('doc-6')
    })

    it('should return rows by keys', async () => {
      const res = await db.view('test', 'byKey', {
        keys: [ 'key-2', 'key-3' ],
      })
      res.rows.length.should.equal(2)
      res.rows[0].id.should.equal('doc-2')
      res.rows[1].id.should.equal('doc-3')
    })
  })

  describe('#findDocByViewKey', () => {
    it('should return a unique doc', async () => {
      const doc = await db.findDocByViewKey('byKey', 'key-1')
      doc._id.should.equal('doc-1')
    })

    it('should return a formatted error', async () => {
      await db.findDocByViewKey('testView', 'notexisting')
      .then(shouldNotBeCalled)
      .catch(err => {
        should(err.statusCode).be.ok()
        should(err.context).be.ok()
      })
    })
  })
})
