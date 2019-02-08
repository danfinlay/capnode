const test = require('tape')
const Crypto = require('../lib/crypto')
const capnode = require('../')

test('crypto module', async (t) => {

  const key = {
    privateKey: '0xd8fef4746e001ecca73a2bb04581969b0e7f711b79dffd304c7c23fa6ac4d8a2',
    address: '0x093ae3d15f8ba8cc9bb7a97d89abdfdf8b4cdbf6',
  }
  const crypto = new Crypto(key)

  const message = {
    id: 0, // unique identifier
    action: 'Foo', // Method name/description
    arguments: '[]', // JSON array for now? Can contain capabilities.
                     // Should name "JSON with capabilities". JSON-cap?
    capability: {
      id: 4567,
      invoker: '0x0', // The permissioned party.
      parentCapability: '0x0', // A pointer to a delegating capability.
      caveats: '', // Currently undefined, but wooowie is this open ended. Jessie validator?
    },
  }

  try {
    const signed = await crypto.sign(message)
    const verifiedSender = await crypto.authenticate(signed)
    console.log('is your address ', verifiedSender)
    t.equal(verifiedSender, key.address, 'Signed and verified a capability action.')
    t.end()
  } catch (e) {
    console.dir(e)
    t.error(e, 'threw error')
    t.end()
  }

})

/*
test('a basic connection', (t) => {
  const crypto = new Crypto(key.privateKey)
  const server = new capnode({
    crypto,
    localApi: {
      foo: () => Promise.resolve('bar'),
      bam: 'baz',
    }
  })

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
