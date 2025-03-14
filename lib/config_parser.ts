import { Agent as httpAgent, type Agent as HttpAgent } from 'node:http'
import { Agent as httpsAgent } from 'node:https'
import type { Agent as HttpsAgent } from 'node:https'

export interface ConfigParams {
  protocol: string
  hostname: string
  port: number
  username: string
  password: string
  debug?: boolean
  agent?: HttpAgent | HttpsAgent
  maxSockets?: number
}

export interface Config {
  origin: string
  host: string
  debug: boolean
  agent: HttpAgent | HttpsAgent
  username: string
  password: string
}

export default ({ protocol, hostname, port, username, password, debug, agent, maxSockets }: ConfigParams) => {
  if (!(protocol === 'http' || protocol === 'https')) {
    throw new Error(`invalid protocol: ${protocol}`)
  }

  const standardHttpPort = protocol === 'http' ? port === 80 : port === 443

  const config = {
    origin: `${protocol}://${hostname}:${port}`,
    username,
    password,
    host: standardHttpPort ? hostname : `${hostname}:${port}`,
    agent: agent || getAgent(protocol, maxSockets),
    // Making sure it's a boolean, defaulting to false
    debug: debug === true,
  }

  return config
}

// Some documentation on the subject of http agents
// https://nodejs.org/api/http.html#http_class_http_agent
// https://github.com/bitinn/node-fetch#custom-agent
// https://github.com/apache/couchdb-nano#pool-size-and-open-sockets
// https://github.com/node-modules/agentkeepalive
function getAgent (protocol: 'http' | 'https', maxSockets = 25) {
  const Agent = protocol === 'https' ? httpsAgent : httpAgent
  return new Agent({
    keepAlive: true,
    maxSockets,
    // Copying the value from https://github.com/apache/couchdb-nano/blob/2ceb3dd/lib/nano.js#L21
    keepAliveMsecs: 30000,
  })
}
