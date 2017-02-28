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

if (!process.env.FIREBASE_URL) {
  throw new Error('environment variable FIREBASE_URL needs to point to a firebase repo with free read/write access!')
}

function createDb (name) {
  return firebase.initializeApp({
    databaseURL: process.env.FIREBASE_URL
  }, name).database()
}

const db = createDb('db')
const db2 = createDb('db2')
const ref = db.ref().child('queue').child('stream-test').push(null).child('streams')
const dateReg = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/

function newRef (t) {
  var dbRef = ref.push({})
  t.tearDown(function () {
    return dbRef.remove()
  })
  return dbRef
}

tearDown(function () {
  return ref.remove().then(function () {
    db.goOffline()
    db2.goOffline()
  })
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
  const finRef = dbRef.child('finished')
  var finishPopulated = null
  const outstream = createWriteStream({
    node: dbRef
  })
  const finishedListener = function (snap) {
    const finished = snap.val()
    if (finished) {
      t.equals(finishPopulated, false, 'Then finished is `false`')
      finishPopulated = true
      finRef.off('value')
    } else if (finished === false) {
      t.equals(finishPopulated, null, 'Finished is `null` at start')
      finishPopulated = false
    } else {
      t.fail('Unexpected state')
    }
  }
  finRef.on('value', finishedListener)
  toStream('Hello World').pipe(outstream)
  t.equals(outstream.url, dbRef.toString(), 'Url matches')
  toString(createReadStream({
    node: db2.refFromURL(outstream.url)
  }), function (err, string) {
    t.equals(finishPopulated, true, 'At the end finished is `true`')
    t.equals(err, null, 'No Error occurred')
    t.equals(string, 'Hello World', 'Data properly transported')
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
        node: db2.refFromURL(outstream.url)
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
        node: db2.refFromURL(outstream.url),
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
    node: db2.refFromURL(outstream.url)
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
        node: db2.refFromURL(outstream.url),
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
        node: db2.refFromURL(outstream.url),
        objectMode: true
      })
        .on('data', function (data) {
          t.same(data, original.shift(), 'I/O comparison')
        })
        .on('end', function () {
          t.equals(original[0], null, 'Null does not trigger a data event')
          t.equals(original.length, 1, 'No other entry left except null')
          t.end()
        })
    })
})

test('writing to simple duplex stream', function (t) {
  toString(toStream('Hello World')
    .pipe(createDuplexStream({
      node: newRef(t)
    })),
    function (err, data) {
      t.equals(err, null, 'No Error occured')
      t.equals(data, 'Hello World', 'Data was simply passed through duplex stream')
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
    t.same(data.data, original.shift(), 'Data matches')
    t.match(data.time, dateReg, 'Correct timestamp')
  })
  stream.on('end', function () {
    t.equals(original.length, 0, 'No buffer left')
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
  var removed = false
  dbRef.on('value', function (snap) {
    if (snap.val() === null) {
      removed = true
    }
  })
  stream.once('data', function (data) {
    stream.dispose()
  })
  stream.on('end', function () {
    removed = true
    t.ok(removed, 'When the stream ends the data should be removed')
    t.end()
  })
  original.forEach(function (entry) {
    stream.write(entry)
  })
  stream.end()
})

test('removing a stream should end the streams', function (t) {
  const dbRef = newRef(t)
  const stream = createDuplexStream({
    node: dbRef,
    allowHalfOpen: false
  })
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
