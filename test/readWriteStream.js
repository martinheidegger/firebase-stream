'use strict'
const tap = require('tap')
const test = tap.test
const tearDown = tap.tearDown
const stream = require('../')
const createReadStream = stream.createReadStream
const createWriteStream = stream.createWriteStream
const createDuplexStream = stream.createDuplexStream
const firebase = require('firebase')
const toStream = require('string-to-stream')
const toString = require('stream-to-string')

const app = firebase.initializeApp({
  databaseURL: 'https://runner-worker.firebaseio-demo.com'
})
const db = app.database()
const ref = db.ref().child('queue').child('stream-test')
const dateReg = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/

function newRef (t) {
  var dbRef = ref.push({})
  t.tearDown(function () {
    return dbRef.remove()
  })
  return dbRef
}

tearDown(function () {
  db.goOffline()
})

test('error instance without node', function (t) {
  try {
    stream()
  } catch (e) {
    t.equals(e.code, 'ERRNODE')
    e.toString() // Should not throw anything
  }
  t.end()
})

test('error instance without node', function (t) {
  t.throws(function () {
    stream({
      node: newRef(t)
    })
  }, {code: 'ERRMODE'}, {})
  t.end()
})

test('simple piping to a stream', function (t) {
  const dbRef = newRef(t)
  const outstream = createWriteStream({
    node: dbRef
  })
  toStream('Hello World').pipe(outstream)
  t.equals(outstream.url, dbRef.toString())
  toString(createReadStream({
    node: ref.child(outstream.key)
  }), function (err, string) {
    t.equals(err, null)
    t.equals(string, 'Hello World')
    t.end()
  })
})

test('reading after everything is written to stream', function (t) {
  const outstream = createWriteStream({
    node: newRef(t)
  })
  toStream('Hello World')
    .pipe(outstream)
    .on('finish', function () {
      toString(createReadStream({
        node: ref.child(outstream.key)
      }), function (err, string) {
        t.equals(err, null)
        t.equals(string, 'Hello World')
        t.end()
      })
    })
})

test('recording of time will make the time available', function (t) {
  const outstream = createWriteStream({
    node: newRef(t),
    enableTime: true
  })
  var result = ''
  toStream('Hello World')
    .pipe(outstream)
    .on('finish', function () {
      createReadStream({
        node: ref.child(outstream.key),
        enableTime: true
      })
        .on('data', function (data) {
          t.equals(typeof data.time, 'string')
          if (data.data === null) {
            t.equals(result, 'Hello World')
            return t.end()
          }
          t.ok(data.data instanceof Buffer)
          result += data.data.toString()
        })
    })
})

test('writing in string steps to a stream with objectMode', function (t) {
  const outstream = createWriteStream({
    node: newRef(t),
    objectMode: true
  })
  const readableStream = new (require('readable-stream').Readable)({ objectMode: true })
  const data = ['Hello ', 'World', null]
  readableStream._read = function (cb) {
    setImmediate(function () {
      this.push(data.shift())
    }.bind(this))
  }
  readableStream.pipe(outstream)
  toString(createReadStream({
    node: ref.child(outstream.key)
  }), function (err, string) {
    t.equals(err, null)
    t.equals(string, 'Hello World')
    t.end()
  })
})

test('writing in string steps to a stream with objectMode with enabled time', function (t) {
  const outstream = createWriteStream({
    node: newRef(t),
    enableTime: true
  })
  const readableStream = new (require('readable-stream').Readable)({objectMode: true})
  const data = ['Hello ', 'World', null]
  readableStream._read = function (cb) {
    setImmediate(function () {
      this.push(data.shift())
    }.bind(this))
  }
  var result = ''
  readableStream
    .pipe(outstream)
    .on('finish', function () {
      createReadStream({
        node: ref.child(outstream.key),
        enableTime: true
      })
        .on('data', function (data) {
          t.equals(typeof data.time, 'string')
          t.match(data.time, dateReg)
          if (data.data === null) {
            t.equals(result, 'Hello World')
            return t.end()
          }
          t.equals(typeof data.data, 'string')
          result += data.data
        })
    })
})

test('writing in objects steps to a stream with objectMode', function (t) {
  const outstream = createWriteStream({node: newRef(t), objectMode: true})
  const readableStream = new (require('readable-stream').Readable)({objectMode: true})
  const original = [{a: 1}, {b: 2}, null]
  const chunks = original.concat()
  readableStream._read = function (cb) {
    setImmediate(function () {
      this.push(chunks.shift())
    }.bind(this))
  }
  readableStream
    .pipe(outstream)
    .on('finish', function () {
      createReadStream({
        node: ref.child(outstream.key),
        objectMode: true
      })
        .on('data', function (data) {
          t.same(data.data, original.shift())
          if (data.data === null) {
            return t.end()
          }
        })
    })
})

test('writing to simple duplex stream', function (t) {
  toString(toStream('Hello World')
    .pipe(createDuplexStream({
      node: newRef(t)
    })),
    function (err, data) {
      t.equals(err, null)
      t.equals(data, 'Hello World')
      t.end()
    }
  )
})

test('writing to a duplex stream with time enabled', function (t) {
  const stream = createDuplexStream({
    node: newRef(t),
    enableTime: true
  })
  const original = [
    {a: 1},
    'Hello'
  ]
  stream.on('data', function (data) {
    t.same(data.data, original.shift())
    t.match(data.time, dateReg)
  })
  stream.on('end', function () {
    t.equals(original.length, 0)
    t.end()
  })
  original.forEach(function (entry) {
    stream.write(entry)
  })
  stream.end()
})

test('writing to a duplex stream with time enabled', function (t) {
  const stream = createDuplexStream({
    node: newRef(t),
    enableTime: true
  })
  const original = [
    {a: 1},
    'Hello'
  ]
  stream.on('data', function (data) {
    t.same(data.data, original.shift())
    t.match(data.time, dateReg)
  })
  stream.on('end', function () {
    t.equals(original.length, 0)
    t.end()
  })
  original.forEach(function (entry) {
    stream.write(entry)
  })
  stream.end()
})

test('disposing a stream should end the streams', function (t) {
  const dbRef = newRef(t)
  const stream = createDuplexStream({
    node: dbRef
  })
  const original = [
    'Hello'
  ]
  var ended = false
  dbRef.on('value', function (snap) {
    if (snap.val() === null) {
      t.ok(ended)
      t.end()
    }
  })
  stream.once('data', function (data) {
    stream.dispose()
  })
  stream.on('end', function () {
    ended = true
  })
  original.forEach(function (entry) {
    stream.write(entry)
  })
  stream.end()
})

test('removing a stream should end the streams', function (t) {
  const dbRef = newRef(t)
  const stream = createDuplexStream({
    node: dbRef
  })
  const original = [
    {a: 1},
    'Hello'
  ]
  var deleted = false
  dbRef.on('value', function (snap) {
    if (snap.val() === null) {
      deleted = true
    } else {
      dbRef.remove()
    }
  })
  stream.on('end', function () {
    t.ok(deleted)
    t.end()
  })
  stream.write('hi')
  stream.read()
})
