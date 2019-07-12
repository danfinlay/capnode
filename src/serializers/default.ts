import {
  IAsyncApiValue,
  IInvocationMessage,
  ICapnodeMessageSender,
  IAsyncFunction,
  ISerializedAsyncApiObject,
  IAsyncType,
  IDeallocMessage,
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
    switch (typeof api) {
      case 'string':
        return this.escape(api);
      case 'number':
        return api;
      case 'boolean':
        return api;
      case 'undefined':
        return api;
      case 'object':
        if (Array.isArray(api)) {
          return api.map((item) => this.serialize(item, registry));
        }
        const ret: {[key:string]: any} = {};
        Object.keys(api).forEach((key:string) => {
          if (key && typeof key === 'string') {
            ret[key] = this.serialize(api[key], registry);
          }
        })
        return ret;
      case 'function':
        let methodId = registry.getId(api);
        if (!methodId) {
          methodId = registry.registerFunction(api);
        }
        return `${this.FUNC_PREFIX}${methodId}`;
    }

    throw new Error('Invalid input: ' + api);
  }    

  deserialize (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender): any {
    switch (typeof data) {
      case 'string':
        let str = this.unescape(data);
        if (str.indexOf(this.FUNC_PREFIX) === 0) {
          const methodId = str.substr(this.FUNC_PREFIX.length);
          return this.deserializeFunction(methodId, registry, sendMessage);
        } 
        return str;
      case 'number':
        return data;
      case 'boolean':
        return data;
      case 'undefined':
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
      return new Promise((res, rej) => {
        const deallocId = random();
        const deallocMessage: IDeallocMessage = {
          type: 'dealloc',
          methodId,
          replyId: deallocId,
        };
        registry.registerPromise(deallocId, res, rej);
        sendMessage(deallocMessage);
      })
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