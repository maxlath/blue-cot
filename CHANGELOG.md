# CHANGELOG
*versions follow [SemVer](http://semver.org)*

## 3.0.0 - 2017-01-14
* Breaking change: removing constructors in favor of factory functions, breaking the module interface (see [Initialization](https://github.com/maxlath/blue-cot#initialization))
* New feature: [View functions](https://github.com/maxlath/blue-cot#view-functions)
* New feature: blue-cot is `this`-free! No need to bind functions context anymore!

## 2.0.0 - 2016-05-13
* Breaking change: updated bluereq to its [version 2.1.0](https://github.com/maxlath/bluereq/blob/master/CHANGELOG.md), returning rejected promises on 4xx errors
