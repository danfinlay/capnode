const test = require('tape')
const capnode = require('../')

test('connecting two instances via streams', async (t) => {

  const object = {
    foo: 'bar',
    baz: async () => 'win',
    other: { 'stuff': 4 },
  }

  const server = capnode.createStreamingServer(object)
  const serverStream = server.stream

  const client = await capnode.createClientFromStream(serverStream)

  // Reconstructing the API over the comms:
  const deserialized = await client.getDeserializedRemoteApi()
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

  t.end()
})

test('streaming: passing a method-having object in response to a method', async (t) => {
  const object = {
    subscribe: (listener) => {
      setTimeout(() => {
        listener(1)
        listener(2)
        listener(3)
      }, 100)
    }
  }

  const server = capnode.createStreamingServer(object)
  const serverStream = server.stream

  const client = await capnode.createClientFromStream(serverStream)

  // Reconstructing the API over the comms:
  const deserialized = await client.getDeserializedRemoteApi()

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


