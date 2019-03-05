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

  function receiveMessage (message) {
    processMessage(message, localMethods, sendMessage, promiseResolvers)
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
        const methodId = random()
        localMethods[methodId] = async (...arguments) => {
          // avoid "this capture".
          return (1, obj[key])(...arguments)
        }
        res[key] = {
          type: 'function',
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
      case 'function':
        res[methodName] = async (...arguments) => {
          const methodId = api[methodName].methodId
          const replyId = random()
          const message = {
            type: 'invocation',
            methodId,
            arguments,
            replyId,
          }
          sendMessage(message)

          return new Promise((res, rej) => {
            // When processing a message,
            // This should be referred to and deallocated.
            promiseResolvers.set(replyId, {
              res, rej,
            })

          })
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

function processMessage (message, localMethods, sendMessage, promiseResolvers) {
  let resolver

  switch (message.type) {

    case 'invocation':

      /* MESSAGE FORMAT:
        const message = {
          type: 'invocation',
          methodId,
          arguments,
          replyId,
        }
      */
      const method = localMethods[message.methodId]
      method(...arguments)
      .then((reply) => {
        const response = {
          type: 'return',
          methodId: message.replyId,
          value: reply,
        }
        sendMessage(response)
      })
      .catch((reason) => {
        const response = {
          type: 'error',
          methodId: message.replyId,
          value: {
            message: reason.message,
            stack: reason.stack,
          },
        }
        sendMessage(response)
      })
      break

    case 'return':
      resolver = promiseResolvers.get(message.methodId)
      const { res } = resolver
      return res(message.value)
      break

    case 'error':
      resolver = promiseResolvers.get(message.methodId)
      const { rej } = resolver
      return rej(message.value)
      break

    default:
      throw new Error ('Unknown message type: ' + message.type)
  }
}

function random () {
  return cryptoRandomString(k_BYTES_OF_ENTROPY)
}
