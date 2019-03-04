const cryptoRandomString = require('crypto-random-string');
const k_BYTES_OF_ENTROPY = 20
const clone = require('clone-deep')

module.exports = {

  // Primary methods:
  createClient,
  createServer,

  // Exposed for unit testing:
  serializeWithReg,

}

function createServer (localApi) {
  const capnode = createCapnode()
  capnode.serializeLocalApi(localApi)
  return capnode
}

function createClient (remoteApi, sendMessage) {
  const capnode = createCapnode()
  capnode.deserializeRemoteApi(remoteApi)
  capnode.addMessageListener(sendMessage)
  return capnode
}

function createCapnode () {
  const localMethods = {}
  const remoteMethods = {}
  const promiseResolvers = new Map()

  let localApi = {}
  let remoteApi = {}

  const listeners = new Set()

  return {
    serialize,
    deserialize,
    receiveMessage,
    serializeLocalApi,
    deserializeRemoteApi,
    getSerializedLocalApi,
    getDeserializedRemoteApi,
    addMessageListener,
    removeMessageListener,
  }

  function getSerializedLocalApi () {
    return localApi
  }

  function getDeserializedRemoteApi () {
    return remoteApi
  }

  function receiveMessage (serialized) {
    const message = deserialize(serialized)
    process(message)
  }

  function process (message) {
    throw new Error('must implement process method')
  }

  function addMessageListener (func) {
    if (func && typeof func === 'function') {
      listeners.add(func)
    }
  }

  function removeMessageListener (func) {
    listeners.delete(func)
  }

  function sendMessage (message) {
    listeners.forEach((listener) => {
      listener(message)
    })
  }

  function serializeLocalApi (obj) {
    localApi = serialize(obj)
    return localApi
  }

  function serialize (obj, res = {}) {
    return serializeWithReg(localMethods, obj, res)
  }

  function deserialize (obj, res = {}) {
    return deserializeRemoteData(obj, remoteMethods, promiseResolvers, res, sendMessage)
  }

  function deserializeRemoteApi (serialized) {
    const deserialized = deserialize(serialized)
    remoteApi = deserialized
    return remoteApi
  }

}


function serializeWithReg (localMethods = {}, obj, res = {}) {
  Object.keys(obj).forEach((key) => {
    switch (typeof obj[key]) {
      case 'function':
        const methodId = cryptoRandomString(k_BYTES_OF_ENTROPY)
        localMethods[methodId] = async (...arguments) => {
          // avoid "this capture".
          return (1, obj[key])(...arguments)
        }
        res[key] = {
          // Distinguish Function from AsyncFunction:
          type: obj[key].constructor.name,
          methodId,
        };
        break;

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

function deserializeRemoteData (data, remoteMethodReg, promiseResolvers, res = {}, sendMessage) {
  reconstructObjectBranch(data, remoteMethodReg, promiseResolvers, res, sendMessage)
  return res
}

function reconstructObjectBranch (api, remoteMethodReg, promiseResolvers, res = {}, sendMessage = noop) {
  Object.keys(api).forEach((methodName) => {
    switch (api[methodName].type) {
      case 'AsyncFunction':
        res[methodName] = (...arguments) => {
          return new Promise((res, rej) => {
            const methodId = api[methodName].methodId
            const replyId = rand()
            const message = {
              methodId,
              arguments,
              replyId,
            }

            // When processing a message,
            // This should be referred to and deallocated.
            promiseResolvers.set(replyId, {
              res, rej,
            })

            sendMessage(message)
          })
        }
        break

      case 'Function':
        res[methodName] = (...arguments) => {
          const methodId = api[methodName].methodId
          const message = {
            methodId,
            arguments,
          }
          sendMessage(message)
        }

        break

      case 'object':
        res[methodName] = {}
        reconstructObjectBranch(api[methodName].value, remoteMethodReg, promiseResolvers, res[methodName], sendMessage)
        break
      default:
        res[methodName] = api[methodName].value
    }
  })
}

function rand () {
  return String(Math.random())
}

function noop () {}

