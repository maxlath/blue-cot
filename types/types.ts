import type { Document, DocumentInsertResponse, DocumentViewQuery } from './nano.js'

export type DocId = string
export type DocRev = string
export type DbName = string
export type DesignDocName = string
export type ViewName = string

export interface NewDoc {
  _id: never
  _rev: never
}

export interface RecoveredDoc {
  _id: DocId
  _rev?: DocRev
}

export type DocTranformer = (doc: Document) => Document

export interface UpdateOptions {
  createIfMissing?: boolean
}

export type jsonKey = string

export interface FindQuery {
  use_index?: string
}

export interface FindOptions {
  explain?: boolean
}

export type MixedKeyElement = string | number | object

export type ViewKey = string | number | MixedKeyElement[] | { [key: string]: MixedKeyElement }

export interface FetchOptions {
  throwOnErrors?: boolean
}

export type TestFunction = (doc: Document) => boolean

export interface API {
  [key: string]: any
}

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
  data: ResponseBody
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

