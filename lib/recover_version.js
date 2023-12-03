import errors_ from './errors.js'

function recover (API, docId, candidatesRevsInfo, currentRevInfo, testFn) {
  const previousRevInfo = candidatesRevsInfo.shift()

  if (previousRevInfo == null) {
    throw errors_.new('no previous version could be found', 400, arguments)
  }

  if (previousRevInfo.status !== 'available') {
    throw errors_.new('previous version isnt available', 400, arguments)
  }

  return API.get(docId, previousRevInfo.rev)
  .then(function (targetVersion) {
    if (typeof testFn === 'function' && !testFn(targetVersion)) {
      return recover(API, docId, candidatesRevsInfo, currentRevInfo, testFn)
    }
    const revertRev = targetVersion._rev
    targetVersion._rev = currentRevInfo.rev
    return API.put(targetVersion)
    .then(function (res) {
      res.revert = revertRev
      return res
    })
  })
}

export default recover
