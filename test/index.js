const test = require('tape')
const Crypto = require('../lib/crypto')
const capnode = require('../')

test('crypto module', async (t) => {
  const key = {
    privKey: '0xe1006e28d22d5b3f2248ce42dbc0d06370d2bfee04b7007399210359e0a50687',
    address: '0x703a84f5c46e3d74cd9839668357cfc38fe8e963',
  }
  const crypto = new Crypto(key)

  const message = { foo: 'bar' }

  try {
    const signed = crypto.sign(message)
  } catch (e) {
    t.error(e, 'threw error')
  }

})

/*
test('a basic connection', (t) => {
  const crypto = new Crypto(key.privKey)
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
