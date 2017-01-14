require('should')
const cot = require('../lib/cot')

describe('cot', function () {
  it('should return a db handler function', function () {
    const dbHandler = cot({
      port: 80,
      hostname: 'foo'
    })
    dbHandler.should.be.a.Function()
  })
})
