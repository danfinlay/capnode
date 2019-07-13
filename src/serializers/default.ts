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

enum LinkableType {
  'object',
  'function',
  'array',
}

type ILinkPlaceholder = {
  type: LinkableType,
  id: number,
}

type SerializedFormat = {
  links: ISerializedAsyncApiObject[],
  value: ISerializedAsyncApiObject,
}

type MetaLinkRegistry = {
  links: Array<IAsyncFunction | Array<any> | object>;
  serializedLinks: ISerializedAsyncApiObject[];
}

type DeserializedMetaRegistry = {
  serializedLinks: ISerializedAsyncApiObject[];
  reconstructed: Array<any>;
}

import { MethodRegistry } from '../method-registry';

export default class DefaultSerializer {
  public ESC_SEQ: string = '!EK';
  public FUNC_PREFIX: string = 'CF:';

  serialize (api: IAsyncApiValue, registry: MethodRegistry): any {
    const meta: MetaLinkRegistry = {
      serializedLinks: [],
      links: [],
    };
    const result: SerializedFormat = {
      links: [],
      value: undefined,
    }
    result.value = this.serializeLeaf(api, registry, meta);
    result.links = meta.serializedLinks;
    return result;
  }

  serializeLeaf (api: IAsyncApiValue, registry: MethodRegistry, meta: MetaLinkRegistry): any {
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
        return this.serializeObject(api, registry, meta);
      case 'function':

        if (!meta.links.includes(api)) {
          meta.links.push(api);
        }
  
        const pointer: ILinkPlaceholder = {
          type: LinkableType.function,
          id: meta.links.indexOf(api),
        }
  
        let methodId = registry.getId(api);
        if (!methodId) {
          methodId = registry.registerFunction(api);
        }

        meta.serializedLinks.push(`${this.FUNC_PREFIX}${methodId}`);
        return pointer;
    }

    throw new Error('Invalid input: ' + JSON.stringify(api));
  } 

  serializeObject(api: IAsyncApiValue, registry: MethodRegistry, meta: MetaLinkRegistry) {
    if (!api || typeof api !== 'object') {
      throw new Error('serializeObject was passed a ' + typeof api);
    }

    if (Array.isArray(api)) {
      if (!meta.links.includes(api)) {
        meta.links.push(api);
        meta.serializedLinks.push(api.map((item) => this.serializeLeaf(item, registry, meta)));
      }

      const pointer: ILinkPlaceholder = {
        type: LinkableType.array,
        id: meta.links.indexOf(api),
      }

      return pointer;
    }

    // It is a normal object:
    if (!meta.links.includes(api)) {

      const ret: {[key:string]: any} = {};
      meta.links.push(api);
      meta.serializedLinks.push(ret);

      Object.keys(api).forEach((key:string) => {
        if (key && typeof key === 'string') {
          ret[key] = this.serializeLeaf(api[key], registry, meta);
        }
      });

    }

    const pointer: ILinkPlaceholder = {
      type: LinkableType.object,
      id: meta.links.indexOf(api),
    }

   return pointer;
  }

  deserialize (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender): any {
    const meta: DeserializedMetaRegistry = {
      serializedLinks: data.links,
      reconstructed: new Array(data.links.length),
    };

    return this.deserializeLeaf(data.value, registry, sendMessage, meta);
  }

  deserializeLeaf (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender, meta: DeserializedMetaRegistry): any {
    switch (typeof data) {
      case 'string':
        let str = this.unescape(data);
        if (str.indexOf(this.FUNC_PREFIX) === 0) {
          const methodId = str.substr(this.FUNC_PREFIX.length);
          return this.deserializeFunction(methodId, registry, sendMessage, meta);
        } 
        return str;
      case 'number':
        return data;
      case 'boolean':
        return data;
      case 'undefined':
        return data;
      case 'object':
        return this.deserializeObject(data, registry, sendMessage, meta);
    }

    throw new Error('Invalid type to deserializeLeaf: ' + typeof data);
  }

  deserializeObject (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender, meta: DeserializedMetaRegistry): any {
    if (!data || !('type' in data)|| !('id' in data)) {
      throw new Error('deserializeObject called on non-pointer: ' + JSON.stringify(data));
    }

    const id: number = data.id;

    switch (data.type) {
      case LinkableType.array:
        throw new Error('must implement array deserialization');

      case LinkableType.function:
        throw new Error('must implement function deserialization')

      case LinkableType.object:
        if (!meta.reconstructed[id]) {

          const ret: {[key:string]: any} = {};
          meta.reconstructed[id] = ret;

          const serialized:any = meta.serializedLinks[id];
          if (typeof serialized !== 'object') {
            throw 'serialized object in non-object form';
          }

          Object.keys(serialized).forEach((key:string) => {
            if (!(key in serialized) || Array.isArray(serialized)) {
              throw 'deserialization error';
            }
            const val:any = serialized[key];
            ret[key] = this.deserializeLeaf(val, registry, sendMessage, meta);
          })
          return ret;
        } else {
          return meta.reconstructed[id];
        }

    }

    throw new Error('deserializeObject called with invalid data ' + data);

    if (Array.isArray(data)) {
      let result: IAsyncType[] = [];
      data.forEach((item: ISerializedAsyncApiObject) => {
        const newItem: IAsyncType = this.deserializeLeaf(item, registry, sendMessage, meta);
        result.push(newItem);
      });
      return result;
    }

    const ret: {[key:string]: any} = {};
    Object.keys(data).forEach((key:string) => {
      const val: IAsyncApiValue | IAsyncApiValue[] = data[key];
      ret[key] = this.deserializeLeaf(val, registry, sendMessage, meta);
    })
    return ret;
  }


  deserializeFunction (methodId: string, registry: MethodRegistry, sendMessage: ICapnodeMessageSender, _meta: DeserializedMetaRegistry): IRemoteAsyncMethod {
    let result: IRemoteAsyncMethod = async (...userArgs) => {
      return new Promise((res, rej) => {

        const replyId = random();
        const invocation: IInvocationMessage = {
          type: 'invocation',
          methodId,
          replyId,
          arguments: this.serialize(userArgs, registry),
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