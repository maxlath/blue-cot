import configParser, { type ConfigParams } from './config_parser.js'
import dbHandle from './db_handle.js'
import { jsonRequestFactory } from './json_request.js'
import viewFunctions from './view_functions.js'
import type { DbName, DesignDocName } from 'types/types.js'

export default function (opts: ConfigParams) {
  const jsonRequest = jsonRequestFactory(configParser(opts))
  return (dbName: DbName, designDocName?: DesignDocName) => {
    const rawDbHandler = dbHandle(jsonRequest, dbName)
    designDocName = designDocName || dbName
    return {
      name: dbName,
      request: jsonRequest,
      designDocName,
      ...rawDbHandler,
      ...viewFunctions(rawDbHandler, designDocName),
    }
  }
}
