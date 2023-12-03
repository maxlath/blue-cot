import errors_ from './errors.js'

/**
 * @typedef { import('../types/types.d.ts').API } API
 * @typedef { import('../types/types.d.ts').DocId } DocId
 * @typedef { import('../types/types.d.ts').RevInfo } RevInfo
 * @typedef { import('../types/types.d.ts').TestFunction } TestFunction
 */

/**
  * @param {API} Api
  * @param {DocId} docId
  * @param {RevInfo[]} candidatesRevsInfo
  * @param {RevInfo} currentRevInfo
  * @param {TestFunction} [testFn]
  */
export async function recover (Api, docId, candidatesRevsInfo, currentRevInfo, testFn) {
  const previousRevInfo = candidatesRevsInfo.shift()

  if (previousRevInfo == null) {
    throw errors_.new('no previous version could be found', 400, arguments)
  }

  if (previousRevInfo.status !== 'available') {
    throw errors_.new('previous version isnt available', 400, arguments)
  }

  const targetVersion = await Api.get(docId, previousRevInfo.rev)
  if (typeof testFn === 'function' && !testFn(targetVersion)) {
    return recover(Api, docId, candidatesRevsInfo, currentRevInfo, testFn)
  }
  const revertRev = targetVersion._rev
  targetVersion._rev = currentRevInfo.rev
  const res = await Api.put(targetVersion)
  res.revert = revertRev
  return res
}
