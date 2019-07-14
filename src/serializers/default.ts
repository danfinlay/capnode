import {
  IAsyncApiValue,
  IInvocationMessage,
  ICapnodeMessageSender,
  IAsyncFunction,
  ISerializedAsyncApiObject,
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
        return api;
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

        meta.serializedLinks.push(methodId);
        return pointer;
    }

    throw new Error('Invalid input: ' + JSON.stringify(api));
  } 

  serializeObject(api: IAsyncApiValue, registry: MethodRegistry, meta: MetaLinkRegistry) {
    if (!api || typeof api !== 'object') {
      throw new Error('serializeObject was passed a ' + typeof api);
    }

    if (Array.isArray(api)) {
      return this.serializeArray(api, registry, meta);
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

  serializeArray (api: IAsyncApiValue, registry: MethodRegistry, meta: MetaLinkRegistry) {
    if (!api || typeof api !== 'object' || !Array.isArray(api)) {
      throw new Error('serializeObject was passed a ' + typeof api);
    }

    if (!meta.links.includes(api)) {
      // Switching these two lines around breaks everything.
      // Isn't that crazy? Took me like an hour to trace it to this.
      meta.serializedLinks.push(api.map((item) => this.serializeLeaf(item, registry, meta)));
      meta.links.push(api);
    }

    const pointer: ILinkPlaceholder = {
      type: LinkableType.array,
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
        return data;
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
        if (!meta.reconstructed[id]) {

          const ret: IAsyncApiValue[]= [];
          meta.reconstructed[id] = ret;

          const serialized:any = meta.serializedLinks[id];
          if (!Array.isArray(serialized)) {
            throw 'Array pointer pointed at non-array link entry.'
          }

          serialized.forEach((item: ISerializedAsyncApiObject) => {
            ret.push(this.deserializeLeaf(item, registry, sendMessage, meta));
          })
          return ret;
        } else {
          return meta.reconstructed[id];
        }

      case LinkableType.function:
        if (!meta.reconstructed[id]) {

          const methodId:any = meta.serializedLinks[id];

          const ret = this.deserializeFunction(methodId, registry, sendMessage);
          meta.reconstructed[id] = ret;
          return ret;

        } else {
          return meta.reconstructed[id];
        }

      case LinkableType.object:
        if (!meta.reconstructed[id]) {
          const serialized:any = meta.serializedLinks[id];

          let ret: {[key:string]: any} = {};
          meta.reconstructed[id] = ret;

          if (typeof serialized !== 'object') {
            throw 'serialized object in non-object form' + serialized;
          }

          Object.keys(serialized).forEach((key:string) => {
            const val:any = serialized[key];
            const func: Function = this.deserializeLeaf(val, registry, sendMessage, meta);
            ret[key] = func;
          })
        }
        return meta.reconstructed[id];

    }

    throw new Error('deserializeObject called with invalid data ' + data);
  }

  deserializeFunction (methodId: string, registry: MethodRegistry, sendMessage: ICapnodeMessageSender): IRemoteAsyncMethod {
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
}

function random () {
  return cryptoRandomString(k_BYTES_OF_ENTROPY)
}