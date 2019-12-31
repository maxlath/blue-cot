const dbHandle = require('./db_handle')
const viewFunctions = require('./view_functions')
const JsonRequest = require('./json_request')
const configParser = require('./config_parser')

module.exports = opts => {
  const jsonRequest = JsonRequest(configParser(opts))
  return (dbName, designDocName) => {
    const API = dbHandle(jsonRequest, dbName)
    API.name = dbName
    API.jsonRequest = jsonRequest
    if (typeof designDocName === 'string') {
      Object.assign(API, viewFunctions(API, designDocName))
      API.designDocName = designDocName
    }
    return API
  }
}
