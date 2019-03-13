const cryptoRandomString = require('crypto-random-string');
const k_BYTES_OF_ENTROPY = 20
const Duplex = require('stream').Duplex

module.exports = {

  // Primary methods:
  createClient,
  createServer,
  createStreamingServer,
  createClientFromStream,

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

function createStreamingServer(localApi) {
  const capnode = createServer(localApi)
  const local = capnode.createStream()
  const serializedApi = capnode.getSerializedLocalApi()
  capnode.stream = local
  local.push({ type: 'init', value: serializedApi })
  return capnode
}

function createClientFromStream (stream) {
  const capnode = createCapnode()

  // Wait for remote interface to be available:
  return new Promise((res, rej) => {
    try {
      const local = capnode.createStream(() => res(capnode))
      capnode.stream = local
      stream.pipe(local).pipe(stream)
    } catch (err) {
      rej(err)
    }
  })
}

function createCapnode () {
  const localMethods = {}
  const remoteMethods = {}
  const promiseResolvers = new Map()

  let localApi = {}
  let remoteApi = {}

  // Local event listeners, broadcasting locally called functions
  // to their remote hosts.
  const listeners = new Set()
  let stream
  let streamReading = false
  const queue = []

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
    queue,
    stream,
    createStream,
  }

  function getSerializedLocalApi () {
    return localApi
  }

  async function getDeserializedRemoteApi () {
    return remoteApi
  }

  function setStream (s) {
    stream = s
  }

  function createStream (setup) {
    const stream = new Duplex({
      objectMode: true,
      write: (chunk, encoding, cb) => {
        try {
          receiveMessage(chunk)
          if (setup && chunk.type === 'init') {
            setup(chunk)
          }
        } catch (err) {
          return cb(err)
        }
        cb()
      },
      read: (size) => {
        streamReading = true

        // recipient is ready to have messages pushed.
        if (queue.length > 0) {
          let next = queue.shift()
          while (stream.push(next)) {
            next = queue.shift()
          }

          if (queue.length > 0) {
            // Recipient is overloaded, resume queueing:
            streamReading = false
          }
        }
      }
    })

    setStream(stream)
    return stream
  }

  function receiveMessage (message) {
    processMessage(message, localMethods, sendMessage, promiseResolvers, deserialize)
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
    if (stream) {
      if (streamReading) {
        stream.push(message)
      } else {
        queue.push(message)
      }
    }

    listeners.forEach((listener) => {
      listener(message)
    })
  }

  function serializeLocalApi (obj) {
    localApi = serialize(obj)
    return localApi
  }

  function serialize (obj, res = {}) {
    return serializeWithReg(localMethods, obj, deserialize, res)
  }

  function deserialize (obj, res = {}) {
    return deserializeRemoteData(obj, remoteMethods, promiseResolvers, res, sendMessage, serialize)
  }

  function deserializeRemoteApi (serialized) {
    const deserialized = deserialize(serialized)
    remoteApi = deserialized
    return remoteApi
  }

}

// MAIN SERIALIZE FUNC
function serializeWithReg (localMethods = {}, obj, deserialize, res = {}) {

  if (typeof obj === 'function') {

    const methodId = random()
    localMethods[methodId] = async (...arguments) => {
      console.log(`2 calling ${methodId}: with arguments`, arguments)
      const deserializedArgs = arguments.map(deserialize)
      // avoid "this capture".
      return (1, obj)(...arguments)
    }
    res = {
      type: 'function',
      methodId,
    };
    return res

  } else if (Array.isArray(obj)) {
    res.type = 'array'
    res.value = obj.map(item => serializeWithReg(localMethods, item, deserialize))
    return res

  } else if (typeof obj === 'object') {
    console.log('serializing object', obj)
    res.type = 'object'
    res.value = {}
    Object.keys(obj).forEach((key) => {
      switch (typeof obj[key]) {
        case 'function':
          const methodId = random()
          localMethods[methodId] = async (...arguments) => {
            console.log(`1 calling ${methodId}:${key} with arguments`, arguments)
            const deserializedArgs = arguments.map(deserialize)
            console.log('deserialized into', deserializedArgs)
            // avoid "this capture".
            return (1, obj[key])(...deserializedArgs)
          }
          res.value[key] = {
            type: 'function',
            methodId,
          };
          break;

        case 'object':
          res.value[key] = serializeWithReg(localMethods, obj[key], deserialize)
          break

        default:
          res.value[key] = {
            type: typeof obj[key],
            value: obj[key],
          }
      }
    })
  } else { // Handle primitives by default:
    res.type = typeof obj
    res.value = obj
  }
  return res
}

function deserializeRemoteData (data, remoteMethodReg, promiseResolvers, res = {}, sendMessage, serializeObject) {
  console.log('deserializing data', JSON.stringify(data, null, 2))
  res = reconstructObjectBranch(data, remoteMethodReg, promiseResolvers, res, sendMessage, serializeObject)
  console.log('into ', res)
  return res
}

// MAIN DESERIALIZE FUNC
function reconstructObjectBranch (api, remoteMethodReg, promiseResolvers, res = {}, sendMessage = noop, serializeObject) {
  console.log('reconstructing', JSON.stringify(api, null, 2))
  switch (api.type) {
    case 'function':
      console.log('well thats a func')
      res = async (...arguments) => {
        const methodId = api.methodId
        const replyId = random()
        const serializedArguments = arguments.map((arg) => {
          return serializeObject(arg)
        })
        console.log('invoking with args', serializedArguments)
        const message = {
          type: 'invocation',
          methodId,
          arguments: serializedArguments,
          replyId,
        }
        sendMessage(message)

        return new Promise((resolve, rej) => {
          // When processing a message,
          // This should be referred to and deallocated.
          promiseResolvers.set(replyId, {
            res: resolve, rej,
          })
        })
      }
      console.log('reconstructed ', typeof res)
      return res
      break;

    case 'array':
      res = api.value.map(item => reconstructObjectBranch(item, remoteMethodReg, promiseResolvers, {}, sendMessage, serializeObject))
      return res
      break;

    case 'object':
      Object.keys(api.value).forEach((methodName) => {
        console.log(`reconstructing object ${methodName} with `, api.value[methodName])
        console.log('res is currently', res)
        res[methodName] = reconstructObjectBranch(api.value[methodName], remoteMethodReg, promiseResolvers, {}, sendMessage, serializeObject)
      })
      console.log('iterated all those keys to get ', res)
      return res
      break;

    default:
      res = api.value
      return res
  }
}

function rand () {
  return String(Math.random())
}

function noop () {}

function processMessage (message, localMethods, sendMessage, promiseResolvers, deserialize) {
  let resolver

  switch (message.type) {

    // For initially receiving a remote interface:
    case 'init':
      deserialize(message.value)
      break;

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
      console.log('deserializing args', message.arguments)
      const deserializedArgs = message.arguments.map(deserialize)
      console.log('deserialized args', deserializedArgs)
      method(...deserializedArgs)
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
