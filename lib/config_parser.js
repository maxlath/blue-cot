module.exports = ({ protocol, hostname, port, username, password, debug }) => {
  const config = {}

  if (!(protocol === 'http' || protocol === 'https')) {
    throw new Error(`invalid protocol: ${protocol}`)
  }

  config.host = `${protocol}://${hostname}:${port}`
  config.username = username
  config.password = password

  config.hostHeader = hostname

  config.agent = config.agent || getAgent(protocol)

  const nonStandardPort = protocol === 'http' ? port !== 80 : port !== 443

  if (nonStandardPort) config.hostHeader += ':' + port

  // Making sure it's a boolean, defaulting to false
  config.debug = debug === true

  return config
}

// Some documentation on the subject of http agents
// https://nodejs.org/api/http.html#http_class_http_agent
// https://github.com/bitinn/node-fetch#custom-agent
// https://github.com/apache/couchdb-nano#pool-size-and-open-sockets
// https://github.com/node-modules/agentkeepalive
const getAgent = protocol => {
  const { Agent } = require(protocol)
  return new Agent({ keepAlive: true })
}
