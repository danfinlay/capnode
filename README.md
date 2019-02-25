# CapNode

Sharing capabillities as easy as passing around JS Promises.

Allows serializing objects that contain promise-returning functions into a crypto-hard JSON format whose chain of custody is verified during deserialization.

Aspires to make decentralized delegation of any computer function as easy as passing around JS Promises, as they were [originally intended](http://www.erights.org/talks/promises/).

## Hypothetical Usage Example

```javascript
const capnode = require('capnode')
const signer = require('a-compliant-crypto-lib-with-a-key')(PRIV_KEY)

const api = {
  getIndex: async () => {
    return Object.keys(this);
  },
  increment: async () => {
    return counter++;
  },
  plugins: {},
  addPlugin: async (name, code) => {
    this.plugins[name] = sandbox.eval(code)
  },
  getPlugin: async (name) => {
    return this.plugins[name].getApi()
  }
}

async function requestPermissions (requestor, permissions) {
  return prompt(`Would you like to give ${requestor} these permissions?: ${permissions}`)
}

const server = capnode.createServer(api, signer, requestPermissions)

// Imagine we are running some `socketHost` to accept requests:
// The server is able to handle arbitrary messages and enforce permissions:
socketHost.on('connection', (socket) => {
  socket.write(server.getIndex())

  socket.on('message', async (message) => {
    const response = await server.handle(message)
    socket.write(response)
  })
})

// We also regularly serialize the server to disk
server.subscribe((newState) => {
  db.write('server', newState)
})
```

That kind of server setup allows a remote API to be constructed that treats the `capnode` provided object as practically local:

```javascript
const capnode = require('capnode')
const signer = require('a-compliant-crypto-lib-with-a-key')(PRIV_KEY)

// Imagine we have some `socketClient` connected to the host
const service = await capnode.createClient(socketClient, signer)

console.log(Object.keys(service))
// > ['getIndex', 'increment', 'plugins', 'addPlugin', 'getPlugin']

run()
async function run () {
  await service.addPlugin('greeter', 'async function () { return 'Hello!'  })')

  const greeting = await service.plugins.greeter()
  console.log(greeting)
  // "Hello!"
}
```

## Status

Very early, just building up some fundamental functions for now, does not work as a whole system yet.

## Direction

I tell a bit of the story of how I got here [in this thread on OcapJs](https://ocapjs.org/t/hi-there-brief-introduction/64).

The general serialization format is basically ocap-ld but with ethereum's signTypedData signature methods, intended to make some of these capabilities redeemable on the ethereum blockchain.

I was thinking it would be cool to use some of the early semantics from [Mark Miller and Hal Finney](https://ocapjs.org/t/abstracting-crypto-into-builtin-ocap-abstractions/55).

This module could have a `seal` and `unseal` method (ocap equivalents of serialize and deserialize).

Transport of the messages could be handled externally, which takes this a small step away from its `dnode`-inspired roots, although I sure wouldn't mind exposing stream interfaces once the seal/unseal is working correctly.


## Todo

Currently just serializing/deserializing. Will need to traverse chains of capabilities, not to mention `unseal` actually is tied to some transport details: The capability should encode suggested redemption methods, like a server to hit, and so those redemption methods will need to be tested as well.

The [ocap-ld spec](https://w3c-ccg.github.io/ocap-ld/#actions) suggests the `action` field can be used to direct the consumer how to redeem the capability, and yet it also seems to suggest the `action` field is only populated on invocations, not on capabilities...

Add support for Arrays to `signTypedData`, so we can have chains of caveats.

Define a caveat schema (for now it's just text. I was thinking use some Jessie run in a Realms shim to run it as invocation sanitation code).

Eventually, we are going to need a parser for these written for the ethereum blockchain. It would be great to integrate it into the test suite here, to make sure we're even serializing the data here in an actually useful way.


