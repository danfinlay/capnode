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

test('deserializing an object', async (t) => {
  const object = {
    foo: 'bar',
    baz: async () => 'win',
    inner: {
      light: async () => 'haha',
    }
  }

  const server = capnode.createServer(object)

  const serializedApi = server.getSerializedLocalApi()

  const client = capnode.createClient(serializedApi, (message) => {
    // Called when a function is called.
    server.receiveMessage(message)
  })

  server.addMessageListener((message) => client.receiveMessage(message))

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



/*
test('a basic connection', (t) => {
  const cap = new capnode({
    foo: () => Promise.resolve('bar'),
    bam: 'baz',
  })

  const

  t.end()

  const client = new capnode({ remoteStream: server.stream })
  console.log('requesting remote api')
  client.requestRemoteApi()
  .then(async (remote) => {
    console.log('remote!', remote)
    t.equal(remote.bam, 'baz', 'remote returned concrete value.')
    const result = await remote.foo()
    t.equal(result, 'bar', 'remote returned correctly.')
    t.end()
  })

  client.exposeLocalApi(server.stream)
})
*/

/*

test('a method in an object', (t) => {

  const server = capnode.create({
    foo: {
      bar: () => Promise.resolve('bam'),
      bizzam: {
        presto: () => Promise.resolve('huzzah!')
      },
    },
  })

  const client = capnode.connect(server)

  client.on('remote', async (remote) => {

    t.equal(typeof remote.foo, 'object')
    t.equal(typeof remote.foo.bar, 'function')
    const result = await remote.foo.bar()
    t.equal(result, 'bam')
    const result2 = await remote.foo.bizzam.presto()
    t.equal(result2, 'huzzah!')
    t.end()
  })

  client.pipe(server).pipe(client)
})
*/

/*
test('ability to return additional promise-returning functions', (t) => {
  const server = capnode.create({
    foo: (cb) => Promise.resolve({
      bam: (arg) => Promise.resolve('baz' + arg)
    }),
  })

  const client = capnode.connect(server)

  client.on('remote', async (remote) => {

    t.equal(remote.bam, 'baz', 'remote returned concrete value.')
    const result = await remote.foo(update)
   t.equal(typeof result, 'object', 'returned an object as expected')
    t.equal(typeof resut.bam, 'function', 'object has a function named bam')
    const result2 = await result.bam('!')
    t.equal(result2, 'baz!', 'Remote operated on nested method.')
    t.end()
  })

  client.pipe(server).pipe(client)
})
*/

/*
test('ability to pass promiseResolving func back to server', (t) => {
  const server = capnode.create({
    foo: async (emit) => {
      emit('update')
      emit('update')
      return Promise.resolve(true)
    }
  })

  const client = capnode.connect(server)

  client.on('remote', async (remote) => {

    t.equal(remote.bam, 'baz', 'remote returned concrete value.')
    const result = await remote.foo(update)

    let callCount = 0
    async function update (arg) {
      t.equal(arg, 'update', 'client could send fn up to server')
      if (++callCount === 2) {
        t.end()
      }
    }
  })

  client.pipe(server).pipe(client)
})

*/
