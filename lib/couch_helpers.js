module.exports = {
  mapDoc: (res) => res.rows.map(row => row.doc),
  firstDoc: (docs) => docs && docs[0]
}
