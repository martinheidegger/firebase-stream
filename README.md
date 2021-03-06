# Pipe to [firebase](https://firebase.google.com) and back

[![Build Status](https://travis-ci.org/martinheidegger/firebase-stream.svg?branch=master)](https://travis-ci.org/martinheidegger/firebase-stream)
[![Coverage Status](https://coveralls.io/repos/github/martinheidegger/firebase-stream/badge.svg?branch=master)](https://coveralls.io/github/martinheidegger/firebase-stream?branch=master)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

`firebase-stream` allows you to pipe any [Node.js stream](https://nodejs.org/api/stream.html)
to a database node in google's firebase and read its data back as stream.

## Usage

Install the library

```
$ npm install --save firebase>3 firebase-stream
```

then you may use it like in the following example:

```javascript
// -------------  SETUP ------------
const firebase = require('firebase')
const app = firebase.initializeApp({
  // Configure your application here
  databaseURL: "<enter your database configuration here>"
})
// Keep the db reference if you want to later disconnect from it
const db = app.database()

// In order to keep a clean database, lets have a namespace for
const dbRef = db.ref().child('my-streams')




// -------------  WRITING ------------

// This will not work if you don't call `npm install firebase-stream` if you didn't do so already!
const stream = require('firebase-stream')
const output = stream.createWriteStream({
  node: dbRef.push(null) // The new stream will pipe in a new child
})

// Write something to the outstream
output.end('Hello World')




// -------------  READING ------------

// Create a new stream that reads from the same database node
const input = stream.createReadStream({
  node: dbRef.child(output.key)
})
// Receive the data sent to firebase
input.on('data', function (data) {
  console.log(String(data))
})
input.on('end', function () {
  // Go offline in order for the Node.js application to close
  db.goOffline()
})
```

## API

```javascript
const stream = require('firebase-stream')
stream.createReadStream({/* options */) // equals to stream({mode: 'r', ...})
stream.createWriteStream({/* options */) // equals to stream({mode: 'w', ...})
stream.createDuplexStream({/* options */) // equals to stream({mode: 'rw', ...})

const instance = stream({
  mode: 'r', // (required) r = read, w = write, rw = read/write , kind of stream to be used on the ref
  node: ref, // (required) reference to a data node of firebase
  enableTime: false, // true switches the options to objectMode and stores the timestamp to each output
  binary: false // true uses binary mode when writing the stream to the db
  // Additional options (like objectMode) are directly forwarded to the stream implementation
})

instance.key // key of the node as in ref.key
instance.url // url of the node as in ref.toString()
instance.dispose() // Remove the data
```

## Binary Modes

By default data sent through the stream is stored as utf8 strings. This should
mostly work just fine (even with binary data). The reason for this is because
big integer arrays do not perform well in firebase. Setting the `binary` options
will store the data as integer Array.

## Data Structure

The reference passed-in to the stream will not be written to.
Instead `firebase-stream` will create two `children`: `finished` and `buffer`.
`finished` will be either `true` or `false`, depending if the stream is finished
or not. `buffer` will contain a list of children that each contains one "chunk"
field and a `time` field. The first entry with `null` as `data` terminates the stream.
