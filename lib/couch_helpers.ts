export function mapDoc<D> (res) {
  return res.rows.map(row => row.doc) as D[]
}

export function firstDoc<D> (docs) {
  return docs && (docs[0] as D)
}
