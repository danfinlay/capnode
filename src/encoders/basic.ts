import {
  IAsyncApiObject,
  IAsyncApiValue,
  IAsyncFunction,
  ICapnode,
  ICapnodeDeserializer,
  ICapnodeMessage,
  ICapnodeSerializer,
} from '../../index';

const cryptoRandomString = require('crypto-random-string');
const k_BYTES_OF_ENTROPY = 20;

export function serialize (localMethods: IAsyncApiObject = {}, obj: IAsyncApiObject, deserialize: Function, res:Object = {}): ISerializedAsyncApiObject {

  if (typeof obj === 'function') {

    const methodId = random()
    localMethods[methodId] = async (...args) => {
      const deserializedArgs = args.map(deserialize)
      // avoid "this capture".
      return (1, obj)(...args)
    }
    res = {
      type: 'function',
      methodId,
    };
    return res

  } else if (Array.isArray(obj)) {
    res.type = 'array'
    res.value = obj.map(item => serialize(localMethods, item, deserialize))
    return res

  } else if (typeof obj === 'object') {
    res.type = 'object'
    res.value = {}
    Object.keys(obj).forEach((key) => {
      switch (typeof obj[key]) {
        case 'function':
          const methodId = random()
          localMethods[methodId] = async (...args) => {
            // avoid "this capture".
            return (1, obj[key])(...args)
          }
          res.value[key] = {
            type: 'function',
            methodId,
          };
          break;

        case 'object':
          res.value[key] = serialize(localMethods, obj[key], deserialize)
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

export function deserialize(data, remoteMethodReg, promiseResolvers, res = {}, sendMessage, serializeObject) {
  res = deserialize(data, remoteMethodReg, promiseResolvers, res, sendMessage, serializeObject)
  return res
}

// MAIN DESERIALIZE FUNC
export function reconstructBranch(api, remoteMethodReg, promiseResolvers, res = {}, sendMessage = noop, serializeObject) {
  switch (api.type) {
    case 'function':
      res = async (...args) => {
        const methodId = api.methodId
        const replyId = random()
        const serializedArguments = args.map((arg) => {
          return serializeObject(arg)
        })
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
      return res
      break;

    case 'array':
      res = api.value.map(item => reconstructObjectBranch(item, remoteMethodReg, promiseResolvers, {}, sendMessage, serializeObject))
      return res
      break;

    case 'object':
      Object.keys(api.value).forEach((methodName) => {
        res[methodName] = reconstructObjectBranch(api.value[methodName], remoteMethodReg, promiseResolvers, {}, sendMessage, serializeObject)
      })
      return res
      break;

    default:
      res = api.value
      return res
  }
}

function random () {
  return cryptoRandomString(k_BYTES_OF_ENTROPY)
}
