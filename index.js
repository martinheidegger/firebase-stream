'use strict'
const Duplex = require('readable-stream').Duplex
const Writable = require('readable-stream').Writable
const Readable = require('readable-stream').Readable

function AppError (code, message) {
  Error.apply(this, [message])
  this.code = code
}
AppError.prototype = Object.create(Error)
AppError.prototype.toString = function () {
  return '[' + this.code + '] ' + this.message
}

const createStream = function (options) {
  if (!options) {
    options = {}
  }
  const rwClean = String(options.mode).trim()
  const readable = rwClean === 'r' || rwClean === 'rw'
  const writable = rwClean === 'w' || rwClean === 'rw'
  if (!options.node) {
    throw new AppError('ERRNODE', 'Option Error: `node` is missing!')
  }
  if (!readable && !writable) {
    throw new AppError('ERRMODE', 'Option Error: `mode` needs to be `r`, `w` or `rw`!')
  }
  const buffer = options.node.child('buffer')
  const finRef = options.node.child('finished')
  var _waitFor
  if (writable) {
    _waitFor = Promise.all([
      options.node.child('started').set(new Date().toISOString()),
      buffer.set([]),
      finRef.set(null)
    ])
  } else {
    _waitFor = Promise.resolve(null)
  }
  if (options.enableTime) {
    // Enable time enforces objectMode on the stream since the times are stored
    // in an object
    options.objectMode = true
  }
  var finished = false
  var lock = false
  var count = 0
  const putNext = function (data, encoding, callback) {
    const payload = {}
    const line = {
      time: new Date().toISOString()
    }
    if (!options.binary && data instanceof Buffer) {
      data = data.toString()
      encoding = 'utf8'
    }
    if (data !== undefined) {
      line.data = data
    }
    if (encoding !== undefined) {
      line.encoding = encoding
    }
    payload[count] = line
    count += 1
    _waitFor.then(function () {
      return buffer.update(payload)
    }).then(function () {
      if (data === null) {
        return finRef.set(new Date().toISOString()).then(function () {
          return new Promise(function (resolve) {
            setImmediate(resolve)
          })
        })
      }
      return null
    }).then(function () {
      if (readable && !lock) {
        // Duplex stream processing
        if (data === null) {
          if (options.enableTime) {
            stream.push(line)
          }
          stream.push(null)
          finish()
        } else if (options.enableTime) {
          stream.push(line)
        } else if (options.objectMode || data === undefined || typeof data === 'string' || data instanceof Buffer) {
          stream.push(data, options.objectMode ? undefined : encoding)
        } else {
          stream.push(String(data))
        }
      }
      if (callback) {
        callback()
      }
    }).catch(function (err) {
      if (callback) {
        callback(err)
      }
      console.log('WARNING: Error in stream')
      console.log(err.stack || err)
    })
  }
  const finish = function () {
    if (!finished) {
      finished = true
      buffer.off('child_removed', removeCheck)
      buffer.off('child_added', onData)
      return true
    }
    return false
  }
  const stream = readable ? (writable ? new Duplex(options) : new Readable(options)) : new Writable(options)
  const onData = function (snap) {
    var raw = snap.val()
    if (raw === null) {
      // This case should never occur. But if it does through manual manipulation
      // it will not break anything
      return
    }
    if (raw.data === undefined) {
      raw.data = null
    } else if (!(
      raw.data === null ||
      typeof raw.data === 'string' ||
      raw.data instanceof Buffer
    )) {
      if (raw.data.type === 'Buffer') {
        raw.data = Buffer.from(raw.data.data)
      } else if (!options.objectMode) {
        // Make sure that we stringify the data
        raw.data = String(raw.data)
      }
    }
    if (raw.data === null) {
      if (finish()) {
        const waitForFinish = function (snap) {
          if (!snap.val()) {
            return
          }
          finRef.off('value', waitForFinish)
          if (options.enableTime) {
            stream.push(raw)
          }
          stream.push(null)
        }
        finRef.on('value', waitForFinish)
      }
    } else if (options.enableTime) {
      stream.push(raw)
    } else {
      stream.push(raw.data, raw.encoding === 'buffer' ? undefined : raw.encoding)
    }
    if (raw.data === null) {
      finish()
    }
  }
  const removeCheck = function (snap) {
    options.node.once('value', function (snap) {
      if (snap.val() === null) {
        lock = true
        if (!finished) {
          if (writable && (!readable || options.allowHalfOpen !== false)) {
            stream.uncork()
            stream.end(null)
          }
          if (readable) {
            stream.resume()
            stream.push(null)
          }
        }
        finish()
      }
    })
  }
  buffer.on('child_removed', removeCheck)
  if (readable) {
    // Duplex stream directly sends back the data
    if (!writable) {
      _waitFor = _waitFor.then(function () {
        return new Promise(function (resolve) {
          const handleInitialValue = function (snap) {
            if (snap.val() === null) {
              return
            }
            buffer.off('value', handleInitialValue)
            if (finished || lock) {
              return // Nothing to do anymore
            }
            buffer.on('child_added', onData)
            snap.forEach(function (child) {
              child.val()
              // onData(child)
            })
            resolve()
          }
          buffer.on('value', handleInitialValue)
        })
      })
      // buffer.on('child_added', onData)
    }
    stream._read = function noop (size) {}
  }
  _waitFor.then(function () {
    _waitFor = Promise.resolve(null)
  })
  if (writable) {
    stream._write = function (chunk, encoding, callback) {
      if (!finished) {
        putNext(chunk, encoding, callback)
      } else {
        setImmediate(callback)
      }
    }
    stream.on('finish', function () {
      if (!finished) {
        putNext(null)
      }
    })
  }
  var _disposed
  stream.dispose = function () {
    if (!_disposed) {
      _disposed = options.node.remove()
    }
    return _disposed
  }
  stream.url = options.node.toString()
  stream.key = options.node.key
  return stream
}
createStream.createReadStream = function (options) {
  return createStream(Object.assign({mode: 'r'}, options))
}
createStream.createWriteStream = function (options) {
  return createStream(Object.assign({mode: 'w'}, options))
}
createStream.createDuplexStream = function (options) {
  return createStream(Object.assign({mode: 'rw'}, options))
}
module.exports = createStream
