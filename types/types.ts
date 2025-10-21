import type { Document, DocumentInsertResponse, DocumentViewQuery } from './nano.js'

export type DocId = string
export type DocRev = string
export type DbName = string
export type DesignDocName = string
export type ViewName = string

export interface NewDoc {
  _id?: DocId
  // _rev: never // Setting it to never triggers "_rev is declared here." errors
}

export interface RecoveredDoc {
  _id: DocId
  _rev?: DocRev
}

export type DocTranformer<D extends Document = Document> = (doc: D) => D

export interface UpdateOptions {
  createIfMissing?: boolean
}

export type jsonKey = string

export interface FindQuery {
  use_index?: string | string[]
  selector?: Record<string, unknown>
  execution_stats?: boolean
}

export interface FindOptions {
  explain?: boolean
}

export type MixedKeyElement = string | number | object

export type ViewKey = string | number | MixedKeyElement[] | Record<string, MixedKeyElement>
export type ViewValue = unknown

export interface FetchOptions {
  throwOnErrors?: boolean
}

export type TestFunction<D extends Document = Document> = (doc: D) => boolean

export type API = Record<string, unknown>

export interface RevInfo {
  rev: DocRev
  status: string
}

export interface FormattedError extends Error {
  status?: number
  statusCode?: number
  context?: string | object
  body?: string | object
}

export interface CouchdbResponse<ResponseBody> {
  statusCode: number
  parsedBody: ResponseBody
}

export type JsonRequest = <ResponseBody> (method: string, path: string, body?: object) => Promise<CouchdbResponse<ResponseBody>>

export interface DocumentDeletedFailure {
  key: string
  error: 'deleted'
}

export type DocumentViewKeysQuery = Omit<DocumentViewQuery, 'keys'>

export interface DocumentViewWithDocsQuery extends Omit<DocumentViewQuery, 'include_docs'> {
  include_docs: true
}

export type DocumentRevertResponse = (DocumentInsertResponse & { revert?: DocRev })

export interface ErrorResponse {
  ok: false
  error: string
  reason: string
}
