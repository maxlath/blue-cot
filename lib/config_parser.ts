import { Agent as httpAgent } from 'node:http'
import { Agent as httpsAgent } from 'node:https'

export interface ConfigParams {
  protocol: string
  hostname: string
  port: number
  username: string
  password: string
  debug?: boolean
}

export default ({ protocol, hostname, port, username, password, debug }: ConfigParams) => {
  if (!(protocol === 'http' || protocol === 'https')) {
    throw new Error(`invalid protocol: ${protocol}`)
  }

  const config = {
    host: `${protocol}://${hostname}:${port}`,
    username,
    password,
    hostHeader: hostname,
    agent: getAgent(protocol),
    // Making sure it's a boolean, defaulting to false
    debug: debug === true,
  }

  const nonStandardPort = protocol === 'http' ? port !== 80 : port !== 443

  if (nonStandardPort) config.hostHeader += ':' + port

  return config
}

// Some documentation on the subject of http agents
// https://nodejs.org/api/http.html#http_class_http_agent
// https://github.com/bitinn/node-fetch#custom-agent
// https://github.com/apache/couchdb-nano#pool-size-and-open-sockets
// https://github.com/node-modules/agentkeepalive
function getAgent (protocol) {
  const Agent = protocol === 'https' ? httpsAgent : httpAgent
  return new Agent({ keepAlive: true })
}
