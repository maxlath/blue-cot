require('should')
const cot = require('../lib/cot')

describe('cot', function () {
  it('should return a db handler function when passed a db name', function () {
    const dbHandler = cot({ port: 80, hostname: 'foo' })
    dbHandler.should.be.a.Function()
    const db = dbHandler('bar')
    Object.keys(db).length.should.equal(dbHanlderFunctions.length)
    dbHanlderFunctions.forEach(function (fnName) {
      db[fnName].should.be.a.Function()
    })
  })

  it('should return an db handler extended with view functions when passed a db name and a design doc name', function () {
    const db = cot({ port: 80, hostname: 'foo' })('bar', 'buzz')
    Object.keys(db).length.should.equal(withViewFunctions.length)
    withViewFunctions.forEach(function (fnName) {
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
  'batch',
  'update',
  'delete',
  'bulk',
  'buildQueryString',
  'viewQuery',
  'view',
  'allDocs',
  'viewKeysQuery',
  'viewKeys',
  'allDocsKeys',
  'changes',
  'jsonRequest'
]

const withViewFunctions = dbHanlderFunctions.concat([
  'viewCustom',
  'viewByKeysCustom',
  'viewByKey',
  'viewFindOneByKey',
  'viewByKeys'
])
