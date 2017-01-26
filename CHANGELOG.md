# CHANGELOG
*versions follow [SemVer](http://semver.org)*

## 3.3.0 - 2017-01-26
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
* Added `db.fetch`

## 3.0.0 - 2017-01-14
* Breaking change: removing constructors in favor of factory functions, breaking the module interface (see [Initialization](https://github.com/maxlath/blue-cot#initialization))
* New feature: [View functions](https://github.com/maxlath/blue-cot#view-functions)
* New feature: blue-cot is `this`-free! No need to bind functions context anymore!

## 2.0.0 - 2016-05-13
* Breaking change: updated bluereq to its [version 2.1.0](https://github.com/maxlath/bluereq/blob/master/CHANGELOG.md), returning rejected promises on 4xx errors
