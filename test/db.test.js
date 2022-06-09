require('should')
const cot = require('../lib/cot')
const config = require('config')
const { wait, catch404, shouldNotBeCalled } = require('./utils')

const randomUpdate = doc => {
  doc.foo = Math.random()
  return doc
}

const putSecurityDoc = db => {
  const doc = {
    admins: { names: [ config.cot.user ] },
    members: { names: [ config.cot.user ] }
  }
  return db.request('PUT', `/${config.dbName}/_security`, doc)
}

describe('DbHandle', () => {
  const db = cot(config.cot)(config.dbName)

  beforeEach(async () => {
    await db.request('DELETE', `/${config.dbName}`).catch(catch404)
    await wait(10)
    await db.request('PUT', `/${config.dbName}`)
    if (config.cot.user) await putSecurityDoc(db)

    await db.post({
      _id: 'person-1',
      type: 'person',
      name: 'Will Conant'
    })

    await db.post({
      _id: '_design/test',
      views: {
        testView: {
          map: 'function(d) { emit(d.name, null) }'
        }
      }
    })
  })

  describe('#docUrl', () => {
    it('should encode doc ids', () => {
      const encoded = db.docUrl('foo/bar')
      encoded.should.equal('/test-cot-node/foo%2Fbar')
    })

    it('should not encode first slash in design doc ids', () => {
      const encoded = db.docUrl('_design/foo/bar')
      encoded.should.equal('/test-cot-node/_design/foo%2Fbar')
    })
  })

  describe('#info', () => {
    it('should return database info', async () => {
      const info = await db.info()
      info.should.be.an.Object()
      info.doc_count.should.equal(2)
    })
  })

  describe('#get', () => {
    it('should return test document from database', async () => {
      const doc = await db.get('person-1')
      doc.should.be.an.Object()
      doc.name.should.equal('Will Conant')
    })

    it('should return a 404 when a doc === missing', done => {
      db.get('missing-doc-id')
      .catch(err => {
        err.statusCode.should.equal(404)
        done()
      })
      .catch(done)
    })

    it('should return a specific version when passed a rev', async () => {
      const firstVersion = await db.get('person-1')
      await db.update('person-1', randomUpdate)
      const specificVersion = await db.get('person-1', firstVersion._rev)
      specificVersion.should.deepEqual(firstVersion)
    })
  })

  describe('#delete', () => {
    it('should delete a document', async () => {
      const doc = await db.get('person-1')
      await db.delete('person-1', doc._rev)
      try {
        await db.get('person-1').then(shouldNotBeCalled)
      } catch (err) {
        err.statusCode.should.equal(404)
      }
    })

    it('should throw an error if no document id is passed', async () => {
      try {
        await db.delete().then(shouldNotBeCalled)
      } catch (err) {
        err.name.should.equal('TypeError')
        err.message.should.equal('invalid doc id')
      }
    })
  })

  describe('#undelete', () => {
    it('should undelete a document', async () => {
      db.undelete.should.be.a.Function()
      const docId = 'person-1'
      const originalDoc = await db.get(docId)
      await db.delete(docId, originalDoc._rev)
      await db.undelete(docId)
      const restoredDoc = await db.get(docId)
      delete originalDoc._rev
      delete restoredDoc._rev
      originalDoc.should.deepEqual(restoredDoc)
    })

    it('should throw when asked to delete a non deleted document', async () => {
      const docId = 'person-1'
      // updating so that there is more than one rev
      await db.update(docId, randomUpdate)
      try {
        await db.undelete(docId).then(shouldNotBeCalled)
      } catch (err) {
        err.message.should.equal("can't undelete an non-deleted document")
      }
    })

    it('should be able to undelete several times the same doc', async () => {
      db.undelete.should.be.a.Function()
      const docId = 'person-1'
      const originalDoc = await db.get(docId)
      // First delete
      await db.delete(docId, originalDoc._rev)
      // First undelete
      await db.undelete(docId)
      const restoredDoc = await db.get(docId)
      const currentRev = restoredDoc._rev
      delete originalDoc._rev
      delete restoredDoc._rev
      originalDoc.should.deepEqual(restoredDoc)
      // Second delete
      await db.delete(docId, currentRev)
      // Second undelete
      await db.undelete(docId)
      const rerestoredDoc = await db.get(docId)
      delete originalDoc._rev
      delete rerestoredDoc._rev
      originalDoc.should.deepEqual(rerestoredDoc)
    })
  })

  describe('#view', () => {
    it('should return a single row', async () => {
      const { rows } = await db.view('test', 'testView', {})
      rows.should.be.an.Array()
      rows.length.should.equal(1)
      rows[0].key.should.equal('Will Conant')
    })
  })

  describe('#put', () => {
    it('should treat conflicts as expected', async () => {
      const doc = { _id: 'put-test' }
      await db.put(doc)
      try {
        await db.put(doc).then(shouldNotBeCalled)
      } catch (err) {
        err.body.error.should.equal('conflict')
      }
    })
  })

  describe('#post', () => {
    it('should treat conflicts as errors', async () => {
      const doc = { _id: 'post-test' }
      await db.post(doc)
      try {
        await db.post(doc).then(shouldNotBeCalled)
      } catch (err) {
        err.statusCode.should.equal(409)
      }
    })
  })

  describe('#batch', () => {
    it('should ignore conflicts', async () => {
      const doc = { _id: 'batch-test' }
      const res = await db.post(doc)
      await db.batch(doc)
      await wait(10)
      const res3 = await db.get(doc._id)
      res3._rev.should.equal(res.rev)
    })
  })

  describe('#exists', () => {
    it('should return true for existing doc', async () => {
      const res = await db.exists('person-1')
      res.should.equal(true)
    })

    it('should return false for non-existent doc', async () => {
      const res = await db.exists('does-not-exist')
      res.should.equal(false)
    })
  })

  describe('#info', () => {
    it('should return the db info', async () => {
      const res = await db.info()
      res.db_name.should.equal('test-cot-node')
    })
  })

  describe('#update', () => {
    it('should apply the passed to the doc', async () => {
      await db.update('person-1', doc => {
        doc.b = 2
        return doc
      })
      const doc = await db.get('person-1')
      doc.b.should.equal(2)
    })

    it('should not create the doc if missing by default', async () => {
      await db.update('does-not-exist', doc => {
        doc.hello = 123
        return doc
      })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(404)
      })
    })

    it('should create the doc if missing, if requested', async () => {
      await db.update('does-still-not-exist', doc => {
        doc.hello = 456
        return doc
      }, { createIfMissing: true })
      const doc = await db.get('does-still-not-exist')
      doc.hello.should.equal(456)
    })
  })

  describe('#bulk', () => {
    it('should post all the passed docs', async () => {
      const res = await db.bulk([
        { _id: 'person-2', type: 'person', name: 'Bobby Lapointe' },
        { _id: 'person-3', type: 'person', name: 'Jean Valjean' },
        { _id: 'person-4', type: 'person', name: 'Rose Tyler' }
      ])
      res.length.should.equal(3)
      res.should.be.an.Array()
      res[0].id.should.equal('person-2')
      res[1].id.should.equal('person-3')
      res[2].id.should.equal('person-4')
    })

    it('should reject bulks with invalid documents', async () => {
      try {
        await db.bulk([
          { _id: 'bla', type: 'person', name: 'Jolyn' },
          null
        ])
        .then(shouldNotBeCalled)
      } catch (err) {
        err.message.should.equal('invalid bulk doc')
        err.statusCode.should.equal(400)
        err.context.index.should.equal(1)
      }
    })

    it('should reject bulks with errors', async () => {
      const doc = { _id: 'blu', type: 'person', name: 'Jolyn' }
      const res = await db.bulk([ doc ])
      doc._rev = res[0].rev
      await db.bulk([ doc ])
      try {
        await db.bulk([ doc ]).then(shouldNotBeCalled)
      } catch (err) {
        err.statusCode.should.equal(400)
      }
    })
  })

  describe('#fetch', () => {
    it('should return all the docs requested', async () => {
      await db.bulk([
        { _id: 'person-2', type: 'person', name: 'Bobby Lapointe' },
        { _id: 'person-3', type: 'person', name: 'Jean Valjean' },
        { _id: 'person-4', type: 'person', name: 'Rose Tyler' }
      ])
      const { docs, errors } = await db.fetch([ 'person-2', 'person-4' ])
      docs.should.be.an.Array()
      docs.length.should.equal(2)
      docs[0]._id.should.equal('person-2')
      docs[1]._id.should.equal('person-4')
      errors.length.should.equal(0)
    })

    it('should report missing docs as errors', async () => {
      await db.bulk([
        { _id: 'person-10', type: 'person', name: 'Bobby Lapointe' }
      ])
      const { docs, errors } = await db.fetch([ 'person-10', 'person-unknown' ])
      docs.length.should.equal(1)
      docs[0]._id.should.equal('person-10')
      errors.length.should.equal(1)
      errors[0].key.should.equal('person-unknown')
      errors[0].error.should.equal('not_found')
    })

    it('should report deleted doc as errors', async () => {
      const { rev } = await db.post({ _id: 'person-8', type: 'person', name: 'Jean Valjean' })
      await db.delete('person-8', rev)
      const { docs, errors } = await db.fetch([ 'person-8' ])
      docs.length.should.equal(0)
      errors.should.deepEqual([
        { key: 'person-8', error: 'deleted' }
      ])
    })
  })

  describe('#list-revs', () => {
    it('should return all the doc revs', async () => {
      db.listRevs.should.be.a.Function()
      await db.update('person-1', randomUpdate)
      await db.update('person-1', randomUpdate)
      const res = await db.listRevs('person-1')
      res.should.be.an.Array()
      res[0].rev.split('-')[0].should.equal('3')
      res[0].status.should.equal('available')
    })
  })

  describe('#revertLastChange', () => {
    it('should revert to the previous version', async () => {
      db.revertLastChange.should.be.a.Function()
      const getCurrentDoc = () => db.get('person-1')

      await db.update('person-1', randomUpdate)
      const previousVersion = await getCurrentDoc()
      await db.update('person-1', randomUpdate)
      const lastVersion = await getCurrentDoc()
      lastVersion._rev.should.not.equal(previousVersion._rev)
      lastVersion.foo.should.not.equal(previousVersion.foo)
      const res = await db.revertLastChange('person-1')
      res.revert.should.equal(previousVersion._rev)
      const restoredVersion = await getCurrentDoc()
      lastVersion.foo.should.not.equal(restoredVersion.foo)
      restoredVersion.foo.should.equal(previousVersion.foo)
    })

    it('should reject when no previous rev can be found', async () => {
      try {
        await db.revertLastChange('person-1').then(shouldNotBeCalled)
      } catch (err) {
        err.message.should.equal('no previous version could be found')
      }
    })
  })

  describe('#allDocs', () => {
    it('should get all docs', async () => {
      const res = await db.allDocs()
      res.total_rows.should.equal(2)
      res.rows.length.should.equal(2)
      res.rows[0].id.should.equal('_design/test')
      res.rows[1].id.should.equal('person-1')
    })
  })

  describe('#allDocsKeys', () => {
    it('should get docs by keys', async () => {
      const res = await db.allDocsKeys([ 'person-1' ])
      res.total_rows.should.equal(2)
      res.rows.length.should.equal(1)
      res.rows[0].id.should.equal('person-1')
    })
  })

  describe('#revertToLastVersionWhere', () => {
    it('should revert to the last matching version', async () => {
      db.revertToLastVersionWhere.should.be.a.Function()

      await db.update('person-1', randomUpdate)
      const res = await db.update('person-1', doc => {
        doc.foo = 2
        return doc
      })
      const targetRev = res.rev
      await db.update('person-1', randomUpdate)
      await db.update('person-1', randomUpdate)
      await db.update('person-1', randomUpdate)
      const res2 = await db.revertToLastVersionWhere('person-1', doc => doc.foo === 2)
      res2.revert.should.equal(targetRev)
      const doc = await db.get('person-1')
      doc.foo.should.equal(2)
    })
  })

  describe('#postIndex', () => {
    it('should create an index', async () => {
      const res = await db.postIndex({
        index: {
          fields: [ 'type' ]
        },
        ddoc: 'test2',
        name: 'by_type'
      })
      res.result.should.equal('created')
    })

    it('should update an index', async () => {
      await db.postIndex({
        index: {
          fields: [ 'type' ]
        },
        ddoc: 'test2',
        name: 'by_type'
      })
      const resB = await db.postIndex({
        index: {
          fields: [ 'type', 'foo' ]
        },
        ddoc: 'test2',
        name: 'by_type'
      })
      resB.result.should.equal('created')
    })
  })

  describe('#find', () => {
    it('should find documents', async () => {
      const res = await db.find({
        selector: {
          type: 'person'
        },
        execution_stats: true
      })
      const { docs, bookmark } = res
      docs.should.be.an.Array()
      docs.find(doc => doc._id === 'person-1').should.be.ok()
      bookmark.should.be.a.String()
    })

    it('should reject requests triggering warning when specifying an index', async () => {
      await db.find({
        selector: { foo: 'bar' },
        use_index: [ 'test', 'by_type' ]
      })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.message.should.equal('No matching index found')
      })
    })

    it('should explain the result of a find query when passed the option explain=true', async () => {
      const res = await db.find({
        selector: {
          type: 'person'
        }
      }, { explain: true })
      res.dbname.should.be.a.String()
      res.index.should.be.an.Object()
      res.opts.should.be.an.Object()
      res.mrargs.should.be.an.Object()
      res.fields.should.be.a.String()
    })
  })
})
