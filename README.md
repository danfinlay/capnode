# CapNode [![CircleCI](https://circleci.com/gh/danfinlay/capnode.svg?style=svg)](https://circleci.com/gh/danfinlay/capnode)

Sharing objects and their methods over a JSON transport as easy as passing around the JS Objects themselves.

## Features different from Dnode:

- All functions are considered async, promise-returning functions.
- Ability to pass functions in return values as well as in arguments, allowing support for subscriptions and event listeners.

## Usage Example

Currently our best examples are in the test folder.

```javascript
test('reconstructing an api and calling it', async (t) => {
  const object = {
    foo: 'bar',
    baz: async () => 'win',
    inner: {
      light: async () => 'haha',
    }
  }

  const server = capnode.createServer(object)

  const serializedApi = server.getSerializedLocalApi()

  // This is just a pure JSON-serializable pojo! Look!
  const serialized = JSON.parse(JSON.stringify(serializedApi))

  const client = capnode.createClient(serialized)

  // Communication should be bidirectional:
  client.addMessageListener(server.receiveMessage)
  server.addMessageListener(client.receiveMessage)

  // Reconstructing the API over the comms:
  const deserialized = client.getDeserializedRemoteApi()

  compareRecursively(object, deserialized)

  function compareRecursively (object, deserialized) {
    Object.keys(object).forEach((key) => {
      switch (typeof key) {
        case 'object':
          compareRecursively(object[key], deserialized[key])
          break
        default:
          t.ok(key in deserialized, `The key ${key} exists in the reconstructed object.`)
          t.equal(typeof deserialized[key], typeof object[key], 'equivalent types for ' + key)
      }
    })
  }

  const result = await deserialized.inner.light()
  t.equal(result, 'haha')
  t.end()

})

test('passing a method-having object in response to a method', async (t) => {
  const object = {
    foo: 'bar',
    baz: async () => 'win',
    inner: {
      light: async () => {
        return {
          ultimate: async () => 'success'
        }
      },
    }
  }

  const server = capnode.createServer(object)

  const serializedApi = server.getSerializedLocalApi()

  const client = capnode.createClient(serializedApi)

  // Communication should be bidirectional:
  client.addMessageListener(server.receiveMessage)
  server.addMessageListener(client.receiveMessage)

  // Reconstructing the API over the comms:
  const deserialized = client.getDeserializedRemoteApi()

  const boss = await deserialized.inner.light()
  const result = await boss.ultimate()
  t.equal(result, 'success')
  t.end()

})

test('passing a method-having object in response to a method', async (t) => {
  const object = {
    subscribe: (listener) => {
      setTimeout(() => {
        listener(1)
        listener(2)
        listener(3)
      }, 100)
    }
  }

  const server = capnode.createServer(object)

  const serializedApi = server.getSerializedLocalApi()

  const client = capnode.createClient(serializedApi)

  // Communication should be bidirectional:
  client.addMessageListener(server.receiveMessage)
  server.addMessageListener(client.receiveMessage)

  // Reconstructing the API over the comms:
  const deserialized = client.getDeserializedRemoteApi()

  let calls = 0
  deserialized.subscribe((counter) => {
    calls++

    switch (calls) {
      case 1:
        t.equal(calls, counter, 'called correctly')
        break

      case 2:
        t.equal(calls, counter, 'called correctly')
        break

      case 3:
        t.equal(calls, counter, 'called correctly')
        t.end()
        break

      default:
        t.ok(false, 'did not call with the right arg')
    }
  })

})

```

## Status

Basic proof of concept is now working. Needs more testing.

Also, until [WeakReference](https://ponyfoo.com/articles/weakref) is added to the JavaScript standard, there is no way to detect a remote has no remaining references to a function, meaning there is an incremented reference count every time a function is passed over this transport, and the only way to clean up that memory for now is to reallocate the whole thing.

## Direction

I tell a bit of the story of how I got here [in this thread on OcapJs](https://ocapjs.org/t/hi-there-brief-introduction/64).

Currently assumes authenticated connections between clients and servers. Eventually I would like to support arbitrary authentication schemes, including chained attenuations like is enabled with [ocap-ld](https://w3c-ccg.github.io/ocap-ld/).

Aspires to make decentralized delegation of any computer function as easy as passing around JS Promises, as they were [originally intended](http://www.erights.org/talks/promises/).

On the `eip-712` branch, the general serialization format is basically ocap-ld but with ethereum's signTypedData signature methods, intended to make some of these capabilities redeemable on the ethereum blockchain.

I was thinking it would be cool to use some of the early semantics from [Mark Miller and Hal Finney](https://ocapjs.org/t/abstracting-crypto-into-builtin-ocap-abstractions/55).

This module could have a `seal` and `unseal` method (ocap equivalents of serialize and deserialize).

Transport of the messages could be handled externally, which takes this a small step away from its `dnode`-inspired roots, although I sure wouldn't mind exposing stream interfaces once the seal/unseal is working correctly.


## Todo

The [ocap-ld spec](https://w3c-ccg.github.io/ocap-ld/#actions) suggests the `action` field can be used to direct the consumer how to redeem the capability, which would be cool to add eventually, so a server could be serving on multiple transports.


