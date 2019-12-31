const dbHandle = require('./db_handle')
const addViewFunctions = require('./view_functions')
const JsonRequest = require('./json_request')
const configParser = require('./config_parser')

module.exports = opts => {
  const jsonRequest = JsonRequest(configParser(opts))
  return (dbName, designDocName) => {
    const API = dbHandle(jsonRequest, dbName)
    if (typeof designDocName === 'string') {
      addViewFunctions(API, designDocName)
    }
    return API
  }
}
