import {
  IAsyncApiValue,
} from '../../index';

import { MethodRegistry } from '../method-registry';

const METHOD_PREFIX = '!CAP_FN:'

export default class DefaultSerializer {

  serialize (api: IAsyncApiValue, registry: MethodRegistry): any {
    switch (typeof api) {
      case 'string':
        // TODO: We _should_ escape the METHOD_PREFIX,
        // But for MVP, it will only ever be mis-interpreted if the
        // method ID also happens to be valid, which is crypto-hard.
        return api;
      case 'number':
        return api;
      case 'boolean':
        return api;
      case 'object':
        const ret: {[key:string]: any} = {};
        Object.keys(api).forEach((key:string) => {
          ret[key] = this.serialize(api[key], registry);
        })
        return ret;
      case 'function':
        let methodId = registry.getId(api);
        if (!methodId) {
          methodId = registry.registerFunction(api);
        }
        return `${METHOD_PREFIX}${methodId}`
    }

    throw new Error('Invalid input');
  }    

  deserialize (data: any, registry: MethodRegistry): IAsyncApiValue {
    switch (typeof data) {
      case 'string':
        if (data.indexOf(METHOD_PREFIX) === 0) {
          const method = registry.getFunction(data.substr(METHOD_PREFIX.length));
          if (method && typeof method === 'function') {
            return method;
          }
        } 
        return data;
      case 'number':
        return data;
      case 'boolean':
        return data;
      case 'object':
        const ret: {[key:string]: any} = {};
        Object.keys(data).forEach((key:string) => {
          ret[key] = this.serialize(data[key], registry);
        })
        return ret;
    }

    throw new Error('Invalid input');
  }

}
