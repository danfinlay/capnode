const cryptoRandomString = require('crypto-random-string');

module.exports = {

  // Primary methods:
  createClient,
//  createServer,

  // Exposed for unit testing:
  serializeWithReg,

}

function createClient (localApi) {

  const localMethods = {}
  const serializedLocalApi = serialize(localApi)

  return harden({
    receiveMessage,
    getSerializedLocalApi,
  })

  function getSerializedLocalApi () {
    return localApi
  }

  function receiveMessage (message) {

  }

  function serialize (obj, res = {}) {
    const objRes = serializeWithReg(localMethods, obj, res)
    return JSON.stringify(objRes)
  }

}


function serializeWithReg (localMethods = {}, obj, res = {}) {
  Object.keys(obj).forEach((key) => {
    switch (typeof obj[key]) {
      case 'function':
        const methodId = cryptoRandomString(20)
        localMethods[methodId] = async (...arguments) => {
          // avoid "this capture".
          return (1, obj[key])(...arguments)
        }
        res[key] = {
          type: 'function',
          methodId,
        }
        break

      case 'object':
        res[key] = {
          type: 'object',
          value: {},
        }

        res[key].value = serializeWithReg(localMethods, obj[key], res[key].value)
        break

      default:
        res[key] = {
          type: typeof obj[key],
          value: obj[key],
        }
    }
  })
  return res
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
function create ({ localApi = {}, localMethodReg = {}, remoteMethodReg = {}, remoteStream = null }) {
  const initialApi = createMethodRegistry(localApi, localMethodReg)
  const connections = new WeakMap() // Stream to a map of its remote method ids.
  let remote, remoteApi // Will represent a connection when complete.

  function exposeLocalApi (newStream) {
    if (!remoteStream) {
      remoteStream = newStream
      multiplex(remoteStream)
    }

    const inboundD = dnode({
      data: initialApi,
      callMethod: async (methodId, serializedParams, cb) => {
        const method = localMethodReg[methodId]
        const remote = await requestRemoteApi()

        const params = deserializeRemoteData(serializedParams, remoteMethodReg, remote)

        method(...params)
        .then((result) => { cb(null, result) })
        .catch((reason) => { cb(reason) })
      },
    })

    newStream.pipe(mx).pipe(newStream)
  }

  async function requestRemoteApi () {
    const outboundD = dnode()
    outbound.pipe(outboundD).pipe(outbound)
    return new Promise ((res, rej) => {
      outboundD.on('remote', (_remote) => {
        remote = _remote
        remoteApi = constructApiFrom(remote)
        res(remoteApi)
      })
    })
  }


  return {
    requestRemoteApi,
    exposeLocalApi,
    stream: mx,
  }
}

function deserializeRemoteData (data, remoteMethodReg, remote) {
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
 *    methodReg: {
 *      [UNIQUE_ID_1]: theMethod,
 *    }
 * }
 *
 */

function createMethodRegistry (obj, methodReg) {
  const res = serialize(obj, methodReg)

  return res
}

function connect (serverStream) {
  return new Client(serverStream)
}

class Client {
  constructor () {
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

    return target.pipe(this.d).pipe(target)
  }
}

// TODO: Make actually crypto hard:
function rand () {
  return String(Math.random())
}

