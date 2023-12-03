import dbHandle from './db_handle.js'
import viewFunctions from './view_functions.js'
import JsonRequest from './json_request.js'
import configParser from './config_parser.js'

export default function (opts) {
  const jsonRequest = JsonRequest(configParser(opts))
  return (dbName, designDocName) => {
    const API = dbHandle(jsonRequest, dbName)
    API.name = dbName
    API.request = jsonRequest
    if (typeof designDocName === 'string') {
      Object.assign(API, viewFunctions(API, designDocName))
      API.designDocName = designDocName
    }
    return API
  }
}
