import config from 'config'
import cot from '../lib/cot.js'
import { catch404, wait } from './utils.js'

let testDb

async function getTestDb () {
  testDb ??= cot(config.cot)(config.dbName, 'test')
  return testDb
}

function putSecurityDoc () {
  const doc = {
    admins: { names: [ config.cot.user ] },
    members: { names: [ config.cot.user ] },
  }
  return testDb.request('PUT', `/${config.dbName}/_security`, doc)
}

export async function resetTestDb (docCount = 10) {
  await getTestDb()
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

  // @ts-expect-error
  batch.push(designDoc)

  await testDb.bulk(batch)
}

export function getArrayOfLength (length: number) {
  // @ts-expect-error
  return new Array(length).fill()
}
