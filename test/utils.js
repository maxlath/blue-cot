const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const catch404 = err => {
  if (err.status !== 404 && err.statusCode !== 404) throw err
}

const shouldNotBeCalled = res => {
  const err = new Error('function was expected not to be called')
  err.name = 'shouldNotBeCalled'
  err.context = { res }
  throw err
}

module.exports = {
  catch404,
  shouldNotBeCalled,
  wait,
}
