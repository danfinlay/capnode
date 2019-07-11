import {
  IAsyncApiValue,
  IInvocationMessage,
  ICapnodeMessageSender,
  IAsyncFunction,
  ISerializedAsyncApiObject,
  IAsyncType,
} from '../@types/index.d';
const cryptoRandomString = require('crypto-random-string');
const k_BYTES_OF_ENTROPY = 20;

interface IRemoteAsyncMethod extends IAsyncFunction {
  dealloc?: () => void;
}

import { MethodRegistry } from '../method-registry';

export default class DefaultSerializer {
  public ESC_SEQ: string = '!EK';
  public FUNC_PREFIX: string = 'CF:';

  serialize (api: IAsyncApiValue, registry: MethodRegistry): any {
    console.log(`ser called with ${api} type of ${typeof api}`)
    switch (typeof api) {
      case 'string':
        return this.escape(api);
      case 'number':
        return api;
      case 'boolean':
        return api;
      case 'object':
        if (Array.isArray(api)) {
          return api.map((item) => this.serialize(item, registry));
        }
        console.log('serializing object')
        const ret: {[key:string]: any} = {};
        Object.keys(api).forEach((key:string) => {
          console.log('calling serialize on ', key)
          if (key && typeof key === 'string') {
            ret[key] = this.serialize(api[key], registry);
          }
        })
        console.log('object serialized to ', ret)
        return ret;
      case 'function':
        console.log('serializing function')
        let methodId = registry.getId(api);
        console.log('method id', methodId)
        if (!methodId) {
          console.log('registering method', api);
          methodId = registry.registerFunction(api);
        }
        return `${this.FUNC_PREFIX}${methodId}`;
    }

    console.log(typeof api)
    throw new Error('Invalid input: ' + api);
  }    

  deserialize (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender): any {
    console.log('deserialize called on ', data);
    console.log('which is a ', typeof data)
    switch (typeof data) {
      case 'string':
        console.log('deserializing a string', data)
        let str = this.unescape(data);
        console.log('unescaped to ', str)
        if (str.indexOf(this.FUNC_PREFIX) === 0) {
          const methodId = str.substr(this.FUNC_PREFIX.length);
          console.log('returning func')
          return this.deserializeFunction(methodId, registry, sendMessage);
        } 
        console.log('returning str')
        return str;
      case 'number':
        return data;
      case 'boolean':
        return data;
      case 'object':
        if (Array.isArray(data)) {
          let result: IAsyncType[] = [];
          data.forEach((item: ISerializedAsyncApiObject) => {
            const newItem: IAsyncType = this.deserialize(item, registry, sendMessage);
            result.push(newItem);
          });
          return result;
        }
        const ret: {[key:string]: any} = {};
        Object.keys(data).forEach((key:string) => {
          const val: IAsyncApiValue | IAsyncApiValue[] = data[key];
          ret[key] = this.deserialize(val, registry, sendMessage);
        })
        return ret;
    }

    throw new Error('Invalid input: ' + data);
  }

  deserializeFunction (methodId: string, registry: MethodRegistry, sendMessage: ICapnodeMessageSender): IRemoteAsyncMethod {
    console.log('method seq identified');
    console.log('registry', registry);
    console.log('method returned', methodId);
    let result: IRemoteAsyncMethod = async (...userArgs) => {
      return new Promise((res, rej) => {

        const replyId = random();
        const invocation: IInvocationMessage = {
          type: 'invocation',
          methodId,
          replyId,
          arguments: userArgs.map((arg) => this.serialize(arg, registry)),
        };
        registry.registerPromise(replyId, res, rej);
        sendMessage(invocation);

      });
    };
    result.dealloc = () => {
      // Deallocation logic goes here.
    }
    return result;
  }

  escape (str: string): string {
    let res = '';
    for (var i = 0; i < str.length; i++) {
      if (str.indexOf(this.ESC_SEQ, i) === i
        || str.indexOf(this.FUNC_PREFIX, i) === i) {
        res += this.ESC_SEQ;
      }
      res += str[i];
    }
    return res;
  }

  unescape (str: string): string {
    let res = '';
    for (var i = 0; i < str.length; i++) {
      if (str.indexOf(this.ESC_SEQ, i) === i) {
        i += this.ESC_SEQ.length - 1;
      } else {
        res += str[i];
      }
    }
    return res;
  }

}

function random () {
  return cryptoRandomString(k_BYTES_OF_ENTROPY)
}