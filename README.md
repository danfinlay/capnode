# CapNode [![CircleCI](https://circleci.com/gh/danfinlay/capnode.svg?style=svg)](https://circleci.com/gh/danfinlay/capnode)

Sharing objects and their methods over a JSON transport as easy as passing around the JS Objects themselves. [Sometimes called](http://blog.ezyang.com/2013/03/what-is-a-membran/) remote proxy objects.

Very much inspired by [dnode](https://www.npmjs.com/package/dnode), but intended to be extended in a few different directions.

Created to make it especially easy for developers to very intuitively create externally consumable APIs.

## Status

Very early WIP, needs thorough audit and QA.

External APIs are pretty simple, so they may be stable, but until [we](https://metamask.io/) are using it in production, I will probably break APIs freely.

Internal serialization schema should be considered highly unstable, as we have plans that involve changing or at least extending it.

Until [WeakReference](https://ponyfoo.com/articles/weakref) is added to the JavaScript standard, there is no way to detect a remote has no remaining references to a function, and so the only way to avoid memory leaks is to use the `.dealloc()` method appended to all functions exported by Capnode. But [WeakRef should be rolling out soon](https://v8.dev/features/weak-references)!

## Features different from Dnode today:

- All functions are considered async, promise-returning functions.
- All objects, including parameters, can include additional functions as children, allowing the passing of complex remote proxy objects, and more intuitive exchanging of APIs across boundaries that do not share memory access.

## Eventual intended features

- I hope to experiment with signing our serialized function references, allowing them to be shared across remotes without requiring a relay.
- I am taking some inspiration from [ocap-ld](https://w3c-ccg.github.io/ocap-ld/) in terms of serializable functions and invocations, and may adopt their schema for allowing discovery of function hosts from nothing but a serialized function itself.
- I am interested in experimenting with "promise pipelining", and related concepts, which could allow, for example, a pending Capnode promise to be passed to another Capnode function as an argument before going offline, allowing those two remotes to resolve the function independently.
- To share a signed function remotely will require supporting signed delegation chains of function references, as part of the serialization format.

## Usage Example

We have an example in [the example folder](./src/example).

It works like this:

```typescript
// server.js

import Capnode from 'capnode';
var net = require('net');
const through = require('through2');



console.log('creating capnode client')
const capnode = new Capnode({});
const remote = capnode.createRemote();

console.log('initializing clinet stream connection');
var remoteStream = net.connect(5004);
remoteStream.pipe(remote).pipe(remoteStream);

async function connect() {
    const index = await capnode.requestIndex(remote);
    const transformed = await index.transform('beep');
    console.log('beep => ' + transformed);
}

connect()
.then(console.log)
.catch(console.error)

```

Client then connects and can call the remote function:

```typescript
import { Stream } from "stream";
var Capnode = require('../../index').default;

var net = require('net');

console.log('creating server')
var server = net.createServer(function (serverStream: Stream) {
    console.log('server created, creating capnode for serving')
    var capnode = new Capnode({
        index: {
            transform : function (s:string) {
                return s.replace(/[aeiou]{2,}/, 'oo').toUpperCase()
            }
        }
    });
    const remote = capnode.createRemote();
    console.log('capnode initialized')
    serverStream.pipe(remote).pipe(serverStream);
});

console.log('server listening...')
server.listen(5004);
console.log('server listening on port 5004');
```

### Test Example:

This example combines client and server code in one block, sorry if that's confusing:

```javascript
  /**
   * The API we want to make available over a serializable async boundary
   * like a network, process, or other context:
   */
  const api: IAsyncApiObject = {
    foo: 'bar',
    baz: async () => 'bam',
    bork: undefined,

    // We can even freely define event-emitting functions:
    on: (eventName, callback) => {
      // whenever we want:
      callback('data', 'hello!');
    },
  }

  // A capnode is made a server by receiving an API as its index:
  const cap = new Capnode({
    index: api,
  });

  // A client is created, perhaps in another process:
  const cap2 = new Capnode({});

  // Each capnode creates a remote, representing its connection to the other:
  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  // Each remote is given a method to send messages to the other:
  remote.addRemoteMessageListener((message) => remote2.receiveMessage(message));
  remote2.addRemoteMessageListener((message) => remote.receiveMessage(message));

  try {
    // We can now request the index from cap1 on cap2:
    const remoteApi: IAsyncApiValue = await cap2.requestIndex(remote2);

    // Notice they are not the same objects:
    t.notEqual(remoteApi, api, 'Api objects are not the same object.');

    // They do, however, share the same properties and tyeps:
   Object.keys(remoteApi).forEach((key) => {
      t.ok(key in api, 'The original api has the key ' + key);
      t.equal(typeof remoteApi[key], typeof api[key], 'The values are the same type');

      // Other than functions, they are even the same value:
      if (typeof remoteApi[key] !== 'function') {
        t.equal(remoteApi[key], api[key]);
      }
    })

    // We can even call the functions provided:
    const result = await remoteApi.baz();
    t.equal(result, 'bam');

  } catch (err) {
    t.error(err);
  }
  t.end();
})

```

### Streams

You can also use the remotes as streams and over streams, for a simplified interface:

```javascript
import Capnode, { streamFromRemote, Remote } from 'capnode';
import { IAsyncApiObject } from '../src/@types/index';
  const api: IAsyncApiObject = {
    foo: 'bar',
    baz: async () => 'bam',
    bork: undefined,
  }

  const cap = new Capnode({
    index: api,
    nickname: 'cap1',
  });

  // Bear with me, imagine cap2 is in a separate process,
  // where objects cannot be freely passed between functions.
  const cap2 = new Capnode({ nickname: 'cap2' });

  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  remote.pipe(remote2).pipe(remote);
```

## API

### constructor: new Capnode(options)

Options:

- index: an optional JavaScript object to be used as the local server's index, when requested from external Remotes.
- registry: an optional MethodRegistry instance, used for restoring a set of function references at construction.
- serializer: an optional Serializer object used to define the schema used in transport.
- nickname: an optional nickname string which can be used for debugging.

### capnode.createRemote(): returns Remote

This method is used to construct a communication channel with a remote entity. It is assumed that each remote is pre-authenticated, and remotes are able to request the index and call functions in the registry freely.

Remotes can be wrapped as streams using the exported `streamFromRemote` function.

Once a remote is received, it should be configured to communicate over a given transport, and so a remote should be constructed at connection time, and it should be configured accordingly.

```javascript
function newConnection (connection) {

  const remote = capnode.createRemote();

  connection.on('message', (message) => remote.receiveMessage(message));
  function sendRemoteMessage (message) {
    connection.send(message);
  }
  remote.addRemoteMessageListener(sendRemoteMessage);

  connection.on('end', () => remote.removeRemoteMessageListener(sendRemoteMessage));
}
```

Alternatively, if you prefer a streaming API:

```javascript
function newConnection (connectionStream) {
  const remote = capnode.createRemote();
  connectionStream.pipe(remote).pipe(connectionStream);
}
```

### clearRemote (remote: Remote)

Removes a given remote, and stops notifying it when there are new outbound messages.

### capnode.requestIndex(remote) returns Promise<AsyncApiValue>

Once a local remote is connected to a remote capnode with an index available, we can request it with this method.

All capnode interactions begin with one side requesting an index from the other side. Any capnode instance can host an index, but only instances that host an index make their functions available to remote connections.

It returns a promise that will resolve in a type we internally call an `AsyncApiValue`. The index itself is also defined as an `AsyncApiValue`.

### AsyncApiValue

An `AsyncApiValue` ([type definition](./src/@types/index.d.ts)) is a value that is either:

- A primitive, JSON-serializable value like `number`, `string`, `undefined`, or `boolean`.
- An Array.
- An object whose keys are strings and whose values are `AsyncApiValue`s.
- Functions which accept `AsyncApiValues` as arguments, and return promises that resolve as an `AsyncApiValue`.

When you are returned one of these values, you are able to mutate your local copy, but your synchronous changes will not affect the remote copy of the object. Only calling the included functions can have remote side effects.

This type is defined because it is what we are able to serialize over a remote [membrane](http://blog.ezyang.com/2013/03/what-is-a-membran/). You can think of it as JSON with promise-returning functions.

### Other Methods

Other methods are basically only needed internally, but I've written this module in TypeScript, so hopefully you find it easy to navigate the source files to find any additional methods you might require.

## CapWrap

This module also exports a convenience method called `capWrap`, which you can use to wrap an object with the default capnode configuration. This could be useful as a form of deep freezing, making functions async, or just for testing capnode behavior on an object you're considering exposing as a remote proxy.

Usage:

```javascript
import { capWrap } from 'capnode';

const yourObject = { foo: async () => 'bar!' }
const aClone = capWrap(yourObject);
```

## Direction

Currently assumes authenticated connections between clients and servers. Eventually I would like to support arbitrary authentication schemes, including chained attenuations like is enabled with [ocap-ld](https://w3c-ccg.github.io/ocap-ld/).

Aspires to make decentralized delegation of any computer function as easy as passing around JS Promises, as they were [originally intended](http://www.erights.org/talks/promises/).

The [ocap-ld spec](https://w3c-ccg.github.io/ocap-ld/#actions) suggests the `action` field can be used to direct the consumer how to redeem the capability, which would be cool to add eventually, so a server could be serving on multiple transports.
