import {
  IAsyncApiValue, ICapnodeMessageSender, IAsyncFunction,
} from '../../index';

import { MethodRegistry } from '../method-registry';

const ESC_SEQ = '!CAP'

export default class DefaultSerializer {

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
        console.log('serializing object')
        const ret: {[key:string]: any} = {};
        Object.keys(api).forEach((key:string) => {
          console.log('calling serialize on ', key)
          ret[key] = this.serialize(api[key], registry);
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
        return this.escape(`${ESC_SEQ}${methodId}`);
    }

    throw new Error('Invalid input');
  }    

  deserialize (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender): IAsyncApiValue {
    console.log('deserialize called on ', data);
    console.log('which is a ', typeof data)
    switch (typeof data) {
      case 'string':
        console.log('deserializing a string', data)
        let str = this.unescape(data);
        console.log('unescaped to ', str)
        if (str.indexOf(ESC_SEQ) === 0) {
          const methodId = str.substr(ESC_SEQ.length);
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
        const ret: {[key:string]: any} = {};
        Object.keys(data).forEach((key:string) => {
          ret[key] = this.deserialize(data[key], registry, sendMessage);
        })
        return ret;
    }

    throw new Error('Invalid input');
  }

  deserializeFunction (methodId: string, registry: MethodRegistry, sendMessage: ICapnodeMessageSender): IAsyncFunction {
    console.log('method seq identified');
    console.log('registry', registry);
    console.log('method returned', methodId);
    return async () => {
      sendMessage({
        type: 'invocation',
        value: methodId,
      });
      return true;
    };
  }

  escape (str: string): string {
    let res = '';
    for (var i = 0; i < str.length; i++) {
      if (str.indexOf(ESC_SEQ) === i) {
        res += ESC_SEQ;
      }
      res += str[i];
    }
    return res;
  }

  unescape (str: string): string {
    let res = '';
    for (var i = 0; i < str.length; i++) {
      if (str.indexOf(ESC_SEQ) === i) {
        i += ESC_SEQ.length - 1;
      } else {
        res += str[i];
      }
    }
    return res;
  }

}
