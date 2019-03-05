const test = require('tape')
const capnode = require('../')

test('serializing an object', (t) => {
  const reg = {}
  const object = {
    foo: 'bar',
    baz: async () => 'win',
    inner: {
      light: () => 'haha',
    }
  }

  const result = capnode.serializeWithReg(reg, object)

  t.equal(typeof result, 'object', 'serialized to object')

  t.ok('foo' in result, 'foo is in object')
  t.ok('baz' in result, 'baz is in object')
  t.ok('inner' in result, 'inner is in result')

  t.equal(result.foo.value, object.foo, 'primitive is recorded')
  t.equal(result.foo.type, 'string', 'primitive type is recorded')

  t.equal(typeof result.baz, 'object', 'func is now obj')
  t.equal(result.baz.type, 'function', 'recorded func type')
  t.ok(result.baz.methodId, 'recorded func id')
  t.ok(result.baz.methodId in reg, 'func is registered')

  t.equal(result.inner.value.light.type, 'function', 'recursive function identified')
  t.equal(typeof reg[result.inner.value.light.methodId], 'function', 'recursively nested func registered')

  t.end()
})

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

  const client = capnode.createClient(serializedApi)

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

