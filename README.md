# Pipe to [firebase](https://firebase.google.com) and back

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
  node: dbRef.push(null) // This means we need to setup
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
  enableTime: false // true switches the options to objectMode and stores the timestamp to each output
  // Additional options (like objectMode) are directly forwarded to the stream implementation
})

instance.key // key of the node as in ref.key
instance.url // url of the node as in ref.toString()
instance.dispose() // Remove the data
```