const dnode = require('dnode')
const duplex = require('duplex')
const EventEmitter = require('events')
const nodeify = require('./lib/nodeify')

module.exports = {
  createServer,
  createClient,
}

/*
 * @class ApiObj
 *
 * The type of object that can be exposed over a capnode stream.
*
 * Each key on the `obj` can be either a concrete value (which is exposed directly to the client)
 * or a promise-returning function.
 *
 * These promise returning functions can themselves return `ApiObj` objects, which are themselves
 * mirrored over the stream, and available for calling their methods.
 *
 * All values must be either concrete values or promise-returning functions.
 */

/*
 * The server constructing function.
 *
 * @param {ApiObj} obj - The object to expose as the API over the stream.
 * @returns Stream - A duplex stream allowing client connections.
 */
function createServer (obj) {
  console.log('creating server')
  const reg = createMethodRegistry(obj)
  return dnode({
    data: reg.data,
    callMethod: (methodId, params, cb) => {
      const method = reg.pointers[methodId]
      console.log('calling method', method)
      console.log('with args', ...params)
      method(...params)
      .then((result) => { cb(null, result) })
      .catch((reason) => { cb(reason) })
    },
  })
}

/*
 * SAMPLE METHOD REGISTRY
 *
 * {
 *    data: {
 *      foo: {
 *        type: 'function',
 *        methodId: UNIQUE_ID_1,
 *      },
 *      bar: {
 *        type: 'string',
 *        value: 'baz',
 *      }
 *    }
 *    pointers: {
 *      [UNIQUE_ID_1]: theMethod,
 *    }
 * }
 *
 */

function createMethodRegistry (obj) {
  const data = {}
  const pointers = {}

  Object.keys(obj).forEach((key) => {
    switch (typeof obj[key]) {
      case 'function':
        const methodId = rand()
        pointers[methodId] = async (...arguments) => {
          // avoid "this capture".
          return (1, obj[key])(...arguments)
        }
        data[key] = {
          type: 'function',
          methodId,
        }
        break
      default:
        data[key] = {
          type: typeof obj[key],
          value: obj[key],
        }
    }
  })

  return { data, pointers }
}

function createClient (serverStream) {
  return new Client(serverStream)
}

class Client extends EventEmitter {
  constructor () {
    super()
    this.stream = duplex()
  }

  pipe(target) {
    console.log('pipe called')
    if (!this.d) {
      this.d = dnode()
      console.log('dnode created')
    }

    this.d.on('remote', (remote) => {
      console.log('remote called', remote)
      this.remote = remote
      this.api = constructApiFrom(remote)
      this.emit('remote', this.api)
    })

    target.pipe(this.d).pipe(target)
    return this.stream
  }
}

function constructApiFrom (remote) {
  console.dir(remote)
  const methods = remote.data
  console.dir(methods)
  const api = {}

  Object.keys(methods).forEach((methodName) => {
    switch (methods[methodName].type) {
      case 'function':
        api[methodName] = (...arguments) => {
          return new Promise((res, rej) => {
            const methodId = methods[methodName].methodId
            remote.callMethod(methodId, [...arguments], (err, ...responses) => {
              if (err) return rej(err)
              res(...responses)
            })
          })
        }
        break
      default:
        api[methodName] = methods[methodName].value
    }
  })

  return api
}

// TODO: Make actually crypto hard:
function rand () {
  return String(Math.random())
}

