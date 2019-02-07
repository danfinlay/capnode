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
  const reg = createMethodRegistry(obj)
  return dnode({
    data: reg.data,
    callMethod: (methodId, params, cb) => {
      const method = reg.pointers[methodId]
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

  populateRegistryBranch(obj, data, pointers)

  return { data, pointers }
}


function populateRegistryBranch(obj, data, pointers) {
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

      case 'object':
        data[key] = {
          type: 'object',
          value: {},
        }
        populateRegistryBranch(obj[key], data[key].value, pointers)
        break

      default:
        data[key] = {
          type: typeof obj[key],
          value: obj[key],
        }
    }
  })
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
    if (!this.d) {
      this.d = dnode()
    }

    this.d.on('remote', (remote) => {
      this.remote = remote
      this.api = constructApiFrom(remote)
      this.emit('remote', this.api)
    })

    target.pipe(this.d).pipe(target)
    return this.stream
  }
}

function constructApiFrom (remote) {
  const methods = remote.data
  const api = {}

  reconstructObjectBranch(api, methods, remote)

  return api
}

function reconstructObjectBranch (api, methods, remote) {
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
      case 'object':
        api[methodName] = {}
        reconstructObjectBranch(api[methodName], methods[methodName].value, remote)
        break
      default:
        api[methodName] = methods[methodName].value
    }
  })
}


// TODO: Make actually crypto hard:
function rand () {
  return String(Math.random())
}

