import 'should'
import cot from '../dist/lib/cot.js'

describe('cot', () => {
  it('should return a db handler function when passed a db name', () => {
    const dbHandler = cot({ protocol: 'http', hostname: 'foo', port: 80, username: 'foo', password: 'fi' })
    dbHandler.should.be.a.Function()
    const db = dbHandler('bar')
    db.name.should.equal('bar')
    db.designDocName.should.equal('bar')
    Object.keys(db).sort().should.deepEqual(dbKeysWithViewFunctions.sort())
    dbHanlderFunctionsWithViewFunctions.forEach(fnName => {
      db[fnName].should.be.a.Function()
    })
  })

  it('should return a db handler with a customized design doc name', () => {
    const db = cot({ protocol: 'http', hostname: 'foo', port: 80, username: 'foo', password: 'fi' })('bar', 'buzz')
    db.name.should.equal('bar')
    db.designDocName.should.equal('buzz')
    Object.keys(db).sort().should.deepEqual(dbKeysWithViewFunctions.sort())
    dbHanlderFunctionsWithViewFunctions.forEach(fnName => {
      db[fnName].should.be.a.Function()
    })
  })
})

const dbHanlderFunctions = [
  'docUrl',
  'info',
  'get',
  'exists',
  'put',
  'post',
  'update',
  'delete',
  'undelete',
  'bulk',
  'buildQueryString',
  'viewQuery',
  'view',
  'allDocs',
  'viewKeysQuery',
  'viewKeys',
  'allDocsKeys',
  'fetch',
  'listRevs',
  'revertLastChange',
  'revertToLastVersionWhere',
  'changes',
  'request',
  'find',
  'postIndex',
  'recover',
]

const viewFunctions = [
  'getDocsByViewQuery',
  'getDocsByViewKeysAndCustomQuery',
  'getDocsByViewKey',
  'findDocByViewKey',
  'getDocsByViewKeys',
]

const dbHanlderFunctionsWithViewFunctions = dbHanlderFunctions.concat(viewFunctions)

const dbKeysWithViewFunctions = [ 'name', 'designDocName' ].concat(dbHanlderFunctions, viewFunctions)
