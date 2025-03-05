import config from 'config'
import cot from '../dist/lib/cot.js'
import { catch404, wait } from './utils.js'

let testDb

async function getTestDb () {
  testDb = testDb || cot(config.cot)(config.dbName, 'test')
  return testDb
}

function putSecurityDoc () {
  const doc = {
    admins: { names: [ config.cot.user ] },
    members: { names: [ config.cot.user ] },
  }
  return testDb.request('PUT', `/${config.dbName}/_security`, doc)
}

export async function resetTestDb (docCount: number = 10) {
  getTestDb()
  await testDb.request('DELETE', `/${config.dbName}`).catch(catch404)
  await wait(100)
  await testDb.request('PUT', `/${config.dbName}`)

  if (config.cot.user) await putSecurityDoc()

  const batch = getArrayOfLength(docCount).map((x, i) => {
    return {
      _id: `doc-${i}`,
      key: `key-${i}`,
    }
  })

  const designDoc = {
    _id: '_design/test',
    views: {
      byKey: {
        map: 'function (doc) { emit(doc.key, null) }',
      },
    },
  }

  batch.push(designDoc)

  await testDb.bulk(batch)
}

export function getArrayOfLength (length: number) {
  return new Array(length).fill()
}
