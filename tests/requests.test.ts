import 'should'
import config from 'config'
import cot from '../dist/lib/cot.js'
import { getArrayOfLength, resetTestDb } from './test_db.js'

describe('request agent', () => {
  const db = cot(config.cot)(config.dbName)

  before(async () => {
    await resetTestDb(100)
  })

  it('should queue requests', async function () {
    this.timeout(10000)
    await Promise.all(getArrayOfLength(200).map(() => {
      return db.view('test', 'byKey', { include_docs: true })
    }))
  })
})
