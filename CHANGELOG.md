# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="1.2.0"></a>
# [1.2.0](https://github.com/martinheidegger/firebase-stream/compare/v1.1.3...v1.2.0) (2017-03-07)


### Bug Fixes

* **state:** Unless the encoding is relevant it stops to store the encoding. ([7a434fb](https://github.com/martinheidegger/firebase-stream/commit/7a434fb))


### Features

* **options:** Added option to store as a binary or string in firebase. ([c9f5e69](https://github.com/martinheidegger/firebase-stream/commit/c9f5e69))
* **state:** Streams now have a `started` field that holds the day started. ([bc208fd](https://github.com/martinheidegger/firebase-stream/commit/bc208fd))
* **status:** The `finished` property in firebase now holds a time ([c78b45e](https://github.com/martinheidegger/firebase-stream/commit/c78b45e))



<a name="1.1.3"></a>
## [1.1.3](https://github.com/martinheidegger/firebase-stream/compare/v1.1.2...v1.1.3) (2017-03-01)


### Bug Fixes

* **read:** Not sure where the encoding “buffer” comes from but it should not be pushed into a stream. ([8bc64a5](https://github.com/martinheidegger/firebase-stream/commit/8bc64a5))



<a name="1.1.2"></a>
## [1.1.2](https://github.com/martinheidegger/firebase-stream/compare/v1.1.1...v1.1.2) (2017-02-28)


### Bug Fixes

* **encoding:** Now supports encoding of buffers ([68516b4](https://github.com/martinheidegger/firebase-stream/commit/68516b4))



<a name="1.1.1"></a>
## [1.1.1](https://github.com/martinheidegger/firebase-stream/compare/v1.1.0...v1.1.1) (2017-02-28)


### Bug Fixes

* Tests were run against local firebase db, now they are properly run with latency (and fixes all the resulting problems) ([300ef33](https://github.com/martinheidegger/firebase-stream/commit/300ef33))



<a name="1.1.0"></a>
# [1.1.0](https://github.com/martinheidegger/firebase-stream/compare/v1.0.0...v1.1.0) (2017-02-27)


### Bug Fixes

* **docs:** Slightly improved unfinished sentence. ([7c93044](https://github.com/martinheidegger/firebase-stream/commit/7c93044))


### Features

* **structure:** Added finished child to find out if a stream has finished ([956ffbf](https://github.com/martinheidegger/firebase-stream/commit/956ffbf))



<a name="1.0.0"></a>
# 1.0.0 (2017-02-27)
