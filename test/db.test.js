require('should')
const cot = require('../lib/cot')
const config = require('config')

const catch404 = err => {
  if (err.statusCode !== 404) throw err
}

const putSecurityDoc = db => {
  const doc = {
    admins: { names: [ config.cot.user ] },
    members: { names: [ config.cot.user ] }
  }
  return db.request('PUT', `/${config.dbName}/_security`, doc)
}

const undesiredRes = done => res => {
  const err = new Error('undesired resolved promise response')
  console.error('undesired response', res)
  done(err)
}

describe('DbHandle', () => {
  const db = cot(config.cot)(config.dbName)

  beforeEach(done => {
    db.request('DELETE', `/${config.dbName}`)
    .catch(catch404)
    .then(() => db.request('PUT', `/${config.dbName}`))
    .then(() => {
      if (config.cot.user) return putSecurityDoc(db)
    })
    .then(() => {
      return db.post({
        _id: 'person-1',
        type: 'person',
        name: 'Will Conant'
      })
    })
    .then(() => {
      return db.post({
        _id: '_design/test',
        views: {
          testView: {
            map: 'function(d) { emit(d.name, null) }'
          }
        }
      })
    })
    .then(() => done())
    .catch(done)
  })

  describe('#docUrl', () => {
    it('should encode doc ids', done => {
      const encoded = db.docUrl('foo/bar')
      encoded.should.equal('/test-cot-node/foo%2Fbar')
      done()
    })

    it('should not encode first slash in design doc ids', done => {
      const encoded = db.docUrl('_design/foo/bar')
      encoded.should.equal('/test-cot-node/_design/foo%2Fbar')
      done()
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

    it('should return a specific version when passed a rev', done => {
      db.get('person-1')
      .then(firstVersion => {
        db.update('person-1', randomUpdate)
        .then(() => db.get('person-1', firstVersion._rev))
        .then(specificVersion => {
          specificVersion.should.deepEqual(firstVersion)
          done()
        })
      })
      .catch(done)
    })
  })

  describe('#delete', () => {
    it('should delete a document', done => {
      db.get('person-1')
      .then(doc => {
        return db.delete('person-1', doc._rev)
        .then(() => {
          return db.get('person-1')
          .catch(err => {
            err.statusCode.should.equal(404)
            done()
          })
        })
      })
      .catch(done)
    })
  })
  describe('#undelete', () => {
    it('should undelete a document', done => {
      db.undelete.should.be.a.Function()
      const docId = 'person-1'
      db.get(docId)
      .then(originalDoc => {
        db.delete(docId, originalDoc._rev)
        .then(res => db.undelete(docId))
        .then(res => db.get(docId))
        .then(restoredDoc => {
          delete originalDoc._rev
          delete restoredDoc._rev
          originalDoc.should.deepEqual(restoredDoc)
          done()
        })
      })
      .catch(done)
    })
    it('should throw when asked to delete a non deleted document', done => {
      const docId = 'person-1'
      // updating so that there is more than one rev
      db.update(docId, randomUpdate)
      .then((res) => db.undelete(docId))
      .catch(err => {
        err.message.should.equal("can't undelete an non-deleted document")
        done()
      })
      .catch(done)
    })
    it('should be able to undelete several times the same doc', done => {
      db.undelete.should.be.a.Function()
      const docId = 'person-1'
      db.get(docId)
      .then(originalDoc => {
        // First delete
        db.delete(docId, originalDoc._rev)
        // First undelete
        .then(res => db.undelete(docId))
        .then(res => db.get(docId))
        .then(restoredDoc => {
          const currentRev = restoredDoc._rev
          delete originalDoc._rev
          delete restoredDoc._rev
          originalDoc.should.deepEqual(restoredDoc)
          // Second delete
          db.delete(docId, currentRev)
          // Second undelete
          .then(res => db.undelete(docId))
          .then(res => db.get(docId))
          .then(restoredDoc => {
            delete originalDoc._rev
            delete restoredDoc._rev
            originalDoc.should.deepEqual(restoredDoc)
            done()
          })
        })
      })
      .catch(done)
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
    it('should treat conflicts as expected', done => {
      const doc = { _id: 'put-test' }
      db.put(doc)
      .then(resp => {
        db.put(doc)
        .then((res) => done(new Error('should not have resolved')))
        .catch(err => {
          err.body.error.should.equal('conflict')
          done()
        })
      })
      .catch(done)
    })
  })

  describe('#post', () => {
    it('should treat conflicts as errors', done => {
      const doc = { _id: 'post-test' }
      db.post(doc)
      .then((res) => db.post(doc))
      .then((res) => done(new Error('should not have resolved')))
      // got the expected error
      .catch((err) => done()) // eslint-disable-line handle-callback-err
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
    it('should return true for existing doc', done => {
      db.exists('person-1')
      .then(res => {
        res.should.equal(true)
        done()
      })
      .catch(done)
    })

    it('should return false for non-existent doc', done => {
      db.exists('does-not-exist')
      .then(res => {
        res.should.equal(false)
        done()
      })
      .catch(done)
    })
  })

  describe('#info', () => {
    it('should return the db info', done => {
      db.info()
      .then(res => {
        res.db_name.should.equal('test-cot-node')
        done()
      })
      .catch(done)
    })
  })

  describe('#update', () => {
    it('should apply the passed to the doc', done => {
      db.update('person-1', (doc) => {
        doc.b = 2
        return doc
      })
      .then(() => db.get('person-1'))
      .then(doc => {
        doc.b.should.equal(2)
        done()
      })
      .catch(done)
    })

    it('should create the doc if missing', done => {
      db.update('does-not-exist', (doc) => {
        doc.hello = 123
        return doc
      })
      .then(() => db.get('does-not-exist'))
      .then(doc => {
        doc.hello.should.equal(123)
        done()
      })
      .catch(done)
    })
  })

  describe('#bulk', () => {
    it('should post all the passed docs', done => {
      db.bulk([
        { _id: 'person-2', type: 'person', name: 'Bobby Lapointe' },
        { _id: 'person-3', type: 'person', name: 'Jean Valjean' },
        { _id: 'person-4', type: 'person', name: 'Rose Tyler' }
      ])
      .then(res => {
        res.length.should.equal(3)
        res.should.be.an.Array()
        res[0].id.should.equal('person-2')
        res[1].id.should.equal('person-3')
        res[2].id.should.equal('person-4')
        done()
      })
      .catch(done)
    })

    it('should reject bulks with invalid documents', done => {
      db.bulk([
        { _id: 'bla', type: 'person', name: 'Jolyn' },
        null
      ])
      .catch(err => {
        err.message.should.equal('invalid bulk doc')
        err.statusCode.should.equal(400)
        err.context.index.should.equal(1)
        done()
      })
      .catch(done)
    })

    it('should reject bulks with errors', done => {
      const doc = { _id: 'blu', type: 'person', name: 'Jolyn' }
      db.bulk([ doc ])
      .then(res => {
        doc._rev = res[0].rev
        return db.bulk([ doc ])
      })
      .then(() => db.bulk([ doc ]))
      .then(undesiredRes(done))
      .catch(err => {
        err.statusCode.should.equal(400)
        done()
      })
      .catch(done)
    })
  })

  describe('#fetch', () => {
    it('should return all the docs requested', done => {
      db.bulk([
        { _id: 'person-2', type: 'person', name: 'Bobby Lapointe' },
        { _id: 'person-3', type: 'person', name: 'Jean Valjean' },
        { _id: 'person-4', type: 'person', name: 'Rose Tyler' }
      ])
      .then(res => {
        db.fetch([ 'person-2', 'person-4' ])
        .then(res => {
          res.should.be.an.Array()
          res.length.should.equal(2)
          res[0]._id.should.equal('person-2')
          res[1]._id.should.equal('person-4')
          done()
        })
      })
      .catch(done)
    })
  })

  describe('#list-revs', () => {
    it('should return all the doc revs', done => {
      db.listRevs.should.be.a.Function()
      db.update('person-1', randomUpdate)
      .then(() => db.update('person-1', randomUpdate))
      .then(res => {
        db.listRevs('person-1')
        .then(res => {
          res.should.be.an.Array()
          res[0].rev.split('-')[0].should.equal('3')
          res[0].status.should.equal('available')
          done()
        })
      })
      .catch(done)
    })
  })

  describe('#revertLastChange', () => {
    it('should revert to the previous version', done => {
      db.revertLastChange.should.be.a.Function()
      const getCurrentDoc = () => db.get('person-1')

      db.update('person-1', randomUpdate)
      .then(getCurrentDoc)
      .then(previousVersion => {
        db.update('person-1', randomUpdate)
        .then(getCurrentDoc)
        .then(lastVersion => {
          lastVersion._rev.should.not.equal(previousVersion._rev)
          lastVersion.foo.should.not.equal(previousVersion.foo)
          db.revertLastChange('person-1')
          .then((res) => res.revert.should.equal(previousVersion._rev))
          .then(getCurrentDoc)
          .then(restoredVersion => {
            lastVersion.foo.should.not.equal(restoredVersion.foo)
            restoredVersion.foo.should.equal(previousVersion.foo)
            done()
          })
        })
      })
      .catch(done)
    })

    it('should reject when no previous rev can be found', done => {
      db.revertLastChange('person-1')
      .catch(err => {
        err.message.should.equal('no previous version could be found')
        done()
      })
      .catch(done)
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
    it('should revert to the last matching version', done => {
      db.revertToLastVersionWhere.should.be.a.Function()

      db.update('person-1', randomUpdate)
      .then(() => {
        return db.update('person-1', doc => {
          doc.foo = 2
          return doc
        })
      })
      .then(res => {
        const targetRev = res.rev
        db.update('person-1', randomUpdate)
        .then(() => db.update('person-1', randomUpdate))
        .then(() => db.update('person-1', randomUpdate))
        .then(() => {
          db.revertToLastVersionWhere('person-1', (doc) => doc.foo === 2)
          .then(res => {
            res.revert.should.equal(targetRev)
            db.get('person-1')
            .then(doc => {
              doc.foo.should.equal(2)
              done()
            })
          })
        })
      })
      .catch(done)
    })
  })
})

const randomUpdate = (doc) => {
  doc.foo = Math.random()
  return doc
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
