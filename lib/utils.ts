import type { IdentifiedDocument } from 'types/nano.js'

export const isPlainObject = obj => {
  return typeof obj === 'object' && !(Array.isArray(obj)) && obj !== null
}

const isArray = arr => arr instanceof Array

export const validateString = (str, label) => {
  if (typeof str !== 'string' || str.length === 0) {
    const errMessage = `invalid ${label}: ${str} (expected string, got (${typeof str}))`
    throw new TypeError(errMessage)
  }
}

export const validateArray = (arr, label) => {
  if (!isArray(arr)) {
    throw new TypeError(`invalid ${label} array: ${JSON.stringify(arr)} (${typeof arr})`)
  }
}

export const validatePlainObject = (obj, label) => {
  if (!isPlainObject(obj)) {
    throw new TypeError(`invalid ${label} object: ${JSON.stringify(obj)} (${typeof obj})`)
  }
}

export const validateNonNull = (obj, label) => {
  if (obj == null) {
    throw new TypeError(`missing ${label}`)
  }
}

export function isIdentifiedDocument (doc): doc is IdentifiedDocument {
  return doc._id != null
}

export const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
