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

function parseInput (raw, objectMode) {
  if (raw === 'null') {
    if (objectMode) {
      return {data: null}
    }
    return null
  }
  const json = JSON.parse(raw)
  if (typeof json === 'string') {
    if (objectMode) {
      return {
        data: json
        // time not stored
      }
    }
    return json || null
  }
  if (json.type === 'Buffer') {
    if (objectMode) {
      return {
        data: Buffer.from(json.data),
        time: json.time
      }
    }
    return Buffer.from(json.data)
  }
  if (objectMode) {
    return json || null
  }
  return json.data || null
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
  const buffer = options.node.child('buffer')
  if (!readable && !writable) {
    throw new AppError('ERRMODE', 'Option Error: `mode` needs to be `r`, `w` or `rw`!')
  }
  options.node.child('finished').set(false)
  if (options.enableTime) {
    // Enable time enforces objectMode on the stream since the times are stored
    // in an object
    options.objectMode = true
  }
  var finished = false
  var lock = false
  const finish = function () {
    if (!finished) {
      finished = true
      if (writable) {
        var time
        if (options.enableTime) {
          time = new Date().toISOString()
          if (!lock) {
            buffer.push('{"data":null,"time":"' + time + '"}')
          }
        } else if (!lock) {
          buffer.push('null')
        }
        if (readable) {
          if (time) {
            stream.push({
              data: null,
              time: time
            })
          }
          stream.push(null)
        }
      }
      if (!lock) {
        options.node.child('finished').set(true)
      }
      buffer.off('child_removed', removeCheck)
      buffer.off('child_added', onData)
    }
  }
  const stream = readable ? (writable ? new Duplex(options) : new Readable(options)) : new Writable(options)
  const onData = function (snap) {
    const raw = snap.val()
    var val = parseInput(raw, options.objectMode)
    const objectOk = (options.objectMode || val instanceof Buffer || typeof val === 'string' || val === null)
    if (!lock) {
      stream.push(objectOk ? val : Buffer.from(String(val)))
    }
    if (options.objectMode && val && val.data === null) {
      stream.push(null)
    }
    if (val === null || val.data === null) {
      finish()
    }
  }
  const removeCheck = function (snap) {
    options.node.once('value', function (snap) {
      if (snap.val() === null) {
        lock = true
        finish()
      }
    })
  }
  buffer.on('child_removed', removeCheck)
  if (readable) {
    // Duplex stream directly sends back the data
    if (!writable) {
      buffer.on('child_added', onData)
    }
    stream._read = function noop (size) {}
  }
  if (writable) {
    stream._write = function (chunk, encoding, callback) {
      if (!finished) {
        var time
        if (options.enableTime) {
          time = (new Date().toISOString())
        }
        var streamOut
        var bufferOut
        if (typeof chunk === 'string' && chunk.length > 0) {
          if (time) {
            bufferOut = '{"data":' + JSON.stringify(chunk) + ',"time":"' + time + '"}'
          } else {
            bufferOut = JSON.stringify(chunk)
          }
          if (readable) {
            if (options.objectMode) {
              streamOut = {
                data: chunk,
                time: time
              }
            } else {
              // TODO: Does this case really exist or does the stream implementation
              // automatically convert to Buffer?
              streamOut = chunk
            }
          }
        } else if ((encoding === 'buffer' || chunk instanceof Buffer) && chunk.length > 0) {
          const val = chunk.toJSON()
          val.time = time
          bufferOut = JSON.stringify(val)
          if (readable) {
            streamOut = time ? val : chunk
          }
        } else if (chunk) {
          if (time) {
            bufferOut = '{"data":' + JSON.stringify(chunk) + ',"time":"' + time + '"}'
          } else {
            bufferOut = '{"data":' + JSON.stringify(chunk) + '}'
          }
          if (readable) {
            streamOut = {
              data: chunk,
              time: time
            }
          }
        }
        // Finished can be set to true by the result of writing to the buffer
        if (streamOut !== undefined) {
          stream.push(streamOut)
        }
        if (bufferOut !== undefined) {
          buffer.push(bufferOut)
        }
      }
      setImmediate(callback)
    }
    stream.on('finish', function () {
      if (!finished) {
        finish()
      }
    })
  }
  var _disposed
  stream.dispose = function () {
    if (!_disposed) {
      _disposed = true
      finish()
      setImmediate(options.node.remove.bind(options.node))
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
