export type DocId = string
export type DocRev = string

export interface Doc {
  _id: DocId
  _rev: DocRev
  [key: string]: any
}

export type DocTranformer = (doc: Doc) => Doc

export interface UpdateOptions {
  createIfMissing?: boolean
}

export type jsonKey = string

export interface ViewQuery {
  conflicts?: boolean
  descending?: boolean
  endkey?: jsonKey
  end_key?: jsonKey
  endkey_docid?: string
  end_key_doc_id?: string
  group?: boolean
  group_level?: number
  include_docs?: boolean
  attachments?: boolean
  att_encoding_info?: boolean
  inclusive_end?: boolean
  key?: jsonKey
  keys?: jsonKey
  limit?: number
  reduce?: boolean
  skip?: number
  sorted?: boolean
  stable?: boolean
  stale?: string
  startkey?: jsonKey
  start_key?: jsonKey
  startkey_docid?: string
  start_key_doc_id?: string
  update?: string
  update_seq?: boolean
}

export interface ChangesQuery {
  doc_ids?: DocId[] | string
  conflicts?: boolean
  descending?: boolean
  feed?: string
  filter?: string
  heartbeat?: number
  include_docs?: boolean
  attachments?: boolean
  att_encoding_info?: boolean
  'last-event-id'?: number
  limit?: number
  style?: string
  since?: string
  timeout?: number
  view?: string
  seq_interval?: number
}

export interface FindQuery {
  use_index?: string
}

export interface FindOptions {
  explain?: boolean
}

export type MixedKeyElement = string | number | object

export type ViewKey = string | MixedKeyElement[] | { [key: string]: MixedKeyElement }

export type ViewKeys = ViewKey[]

export interface FetchOptions {
  throwOnErrors?: boolean
}

export type TestFunction = (doc: Doc) => boolean

export interface API {
  [key: string]: any
}

export interface RevInfo {
  rev: DocRev
  status: string
}

export interface IndexDoc {
  index: object
  ddoc?: string
  name?: string
  type?: 'json' | 'text'
  partitioned?: boolean
}

export type FormattedError = Error & {
  statusCode?: number
  context?: string | object
  body?: string | object
}

export interface CouchdbResponse {
  statusCode: number
  data: object
}

export type JsonRequest = (method: string, path: string, body?: object) => Promise<CouchdbResponse>
