import config from 'config'
import cot from '../dist/lib/cot.js'
import { catch404, wait } from './utils.js'

let testDb

const getTestDb = () => {
  testDb = testDb || cot(config.cot)(config.dbName, 'test')
  return testDb
}

const putSecurityDoc = () => {
  const doc = {
    admins: { names: [ config.cot.user ] },
    members: { names: [ config.cot.user ] },
  }
  return testDb.request('PUT', `/${config.dbName}/_security`, doc)
}

const resetTestDb = async function () {
  getTestDb()
  await testDb.request('DELETE', `/${config.dbName}`).catch(catch404)
  await wait(100)
  await testDb.request('PUT', `/${config.dbName}`)

  if (config.cot.user) await putSecurityDoc()

  const docPromises = []
  let i = 1
  while (i < 10) {
    const doc = {
      _id: `doc-${i}`,
      key: `key-${i}`,
    }
    docPromises.push(testDb.post(doc))
    i++
  }

  const designDoc = {
    _id: '_design/test',
    views: {
      testView: {
        map: 'function(d) { emit(d.name, null) }',
      },
      byKey: {
        map: 'function (doc) { emit(doc.key, null) }',
      },
    },
  }

  docPromises.push(testDb.post(designDoc))

  await Promise.all(docPromises)
}

export default {
  getTestDb,
  resetTestDb,
}
