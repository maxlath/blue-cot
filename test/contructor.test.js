import 'should'
import cot from '../dist/lib/cot.js'

describe('cot', () => {
  it('should return a db handler function when passed a db name', () => {
    const dbHandler = cot({ protocol: 'http', hostname: 'foo', port: 80, username: 'foo', password: 'fi' })
    dbHandler.should.be.a.Function()
    const db = dbHandler('bar')
    db.name.should.equal('bar')
    Object.keys(db).sort().should.deepEqual(dbKeys.sort())
    dbHanlderFunctions.forEach(fnName => {
      db[fnName].should.be.a.Function()
    })
  })

  it('should return an db handler extended with view functions when passed a db name and a design doc name', () => {
    const db = cot({ protocol: 'http', hostname: 'foo', port: 80, username: 'foo', password: 'fi' })('bar', 'buzz')
    Object.keys(db).length.should.equal(dbKeysWithViewFunctions.length)
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
  'viewCustom',
  'viewByKeysCustom',
  'viewByKey',
  'viewFindOneByKey',
  'viewByKeys',
]

const dbHanlderFunctionsWithViewFunctions = dbHanlderFunctions.concat(viewFunctions)

const dbKeys = [ 'name' ].concat(dbHanlderFunctions)
const dbKeysWithViewFunctions = [ 'name', 'designDoc' ].concat(dbHanlderFunctions, viewFunctions)
