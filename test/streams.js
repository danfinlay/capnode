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

