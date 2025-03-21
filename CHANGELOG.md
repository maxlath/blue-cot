# CHANGELOG
*versions follow [SemVer](http://semver.org)*

## 9.1.0 - 2025-03-05
New Features:
* Allow to configure the default http agent `maxSockets` value. Default = 25

## 9.0.0 - 2024-03-07
**BREAKING CHANGES**:
- rename `viewByKey` => `getDocsByViewKey`
- rename `viewByKeys` => `getDocsByViewKeys`
- rename `viewFindOneByKey` => `findDocByViewKey`
- rename `viewCustom` => `getDocsByViewQuery`
- rename `viewByKeysCustom` => `getDocsByViewKeysAndCustomQuery`

## 8.0.0 - 2024-03-05
**BREAKING CHANGES**:
  - use ESM import/export
  - removed `db.batch` method: use `db.post(doc, { batch: 'ok' })` or `db.put(doc, { batch: 'ok' })` instead
- New feature: add types

## 7.0.0 - 2022-01-18
**BREAKING CHANGES**:
- [view functions](https://github.com/maxlath/blue-cot#view) and [`db.changes`](https://github.com/maxlath/blue-cot#changes) now reject unkwown query parameters
- [`db.changes`](https://github.com/maxlath/blue-cot#changes): removing `longpoll` parameter, has it's a feed flag, and the `db.changes` function doesn't not handle feeds (it doesn't play well with promises)

## 6.2.0 - 2021-01-02
* Added [`db.postIndex`](https://github.com/maxlath/blue-cot#postIndex)
* Added [`db.find`](https://github.com/maxlath/blue-cot#find)

## 6.1.0 - 2020-09-28
[`db.update`](https://github.com/maxlath/blue-cot#update): allow to set `createIfMissing=true`, allowing to recover the behavior from `< 6.0.0`

## 6.0.0 - 2020-08-10
**BREAKING CHANGES**: [`db.update`](https://github.com/maxlath/blue-cot#update) stops to create empty (`{ _id }`) docs when the updated doc can't be found, rejecting with a 404 instead.

## 5.0.0 - 2020-08-10
**BREAKING CHANGES**: [`db.fetch`](https://github.com/maxlath/blue-cot#fetch) now returns a { docs, errors } object

## 4.0.0 - 2019-12-31
**BREAKING CHANGES**:
* `blue-cot` returns native promises instead of Bluebird promises (but you can easily [recover that feature](https://github.com/maxlath/blue-cot#with-bluebird))
* Config parameters changes:
  * Replaced `ssl` flag by `protocol` parameter
  * Renamed `user` -> `username`
  * Renamed `pass` -> `password`
  * Removed `gzip` flag
  * Removed `auth` paramater: use `username` and `password`
* Functions changes:
  * Renamed `db.jsonRequest` -> `db.request`

New Features:
* Default http agent reuses sockets by setting `keepAlive=true` flag.
* A custom http agent can be passed

## 3.5.0 - 2018-03-02
* Added a compression option: `gzip` (see [Initialization](https://github.com/maxlath/blue-cot#initialization))

## 3.4.0 - 2017-01-26
* Added [`db.undelete`](https://github.com/maxlath/blue-cot#undelete)

## 3.3.0 - 2017-01-23
* Added [`db.revertToLastVersionWhere`](https://github.com/maxlath/blue-cot#reverttolastversionwhere)

## 3.2.0 - 2017-01-23
* Added [`db.listRevs`](https://github.com/maxlath/blue-cot#listrevs)
* Added [`db.revertLastChange`](https://github.com/maxlath/blue-cot#revertlastchange)
* Added `db.revertLastChange`
* `db.get` accepts a `rev` id as second parameter

## 3.1.0 - 2017-01-14
* Added [`db.fetch`](https://github.com/maxlath/blue-cot#fetch)

## 3.0.0 - 2017-01-14
* Breaking change: removing constructors in favor of factory functions, breaking the module interface (see [Initialization](https://github.com/maxlath/blue-cot#initialization))
* New feature: [View functions](https://github.com/maxlath/blue-cot#view-functions)
* New feature: blue-cot is `this`-free! No need to bind functions context anymore!

## 2.0.0 - 2016-05-13
* Breaking change: updated bluereq to its [version 2.1.0](https://github.com/maxlath/bluereq/blob/master/CHANGELOG.md), returning rejected promises on 4xx errors
