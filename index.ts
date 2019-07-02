import { Duplex } from "stream";
import * as encoder from './src/encoders/basic';

const serializeWithReg = encoder.serialize;
const deserializeRemoteData = encoder.deserialize;

module.exports = {

  // Primary methods:
  createClient,
  createServer,
  createStreamingServer,
  createClientFromStream,

  // Exposed for unit testing:
  serializeWithReg,
}


export type IAsyncApiObject = { [key: string]: IAsyncApiValue };
export type IAsyncFunction = (...args: IAsyncApiObject[]) => Promise<IAsyncApiObject>;
export type IPrimitiveValue = string | number;
export type IAsyncApiValue = IAsyncApiObject | IAsyncFunction | IPrimitiveValue;

export type ICapnodeMessage = {
  type: 'init' | 'invocation' | 'error' | 'return';
  value: any;
  arguments?: ISerializedAsyncApiObject[];
  methodId?: string;
  replyId?: string;
};
export type ISerializedAsyncApiObject = {
  type: string;
  value: IPrimitiveValue | ISerializedAsyncApiObject;
};

export type ICapnodeSerializer = Function;
export type ICapnodeDeserializer = Function;

export interface ICapnode {
  nick: string;
  listeners: Object;
  serializeLocalApi: (localApi: IAsyncApiObject) => void;
  deserializeRemoteApi: (localApi: ISerializedAsyncApiObject) => IAsyncApiObject;
  addListener: (listener: Function) => void;
  serialize: (object:IAsyncApiObject, result?: ISerializedAsyncApiObject) => ISerializedAsyncApiObject;
  deserialize: (serial: ISerializedAsyncApiObject, result?: IAsyncApiObject) => IAsyncApiObject;
  receiveMessage: (message: ICapnodeMessage) => void;
  getSerializedLocalApi: () => ISerializedAsyncApiObject | undefined;
  getDeserializedRemoteApi: () => Promise<IAsyncApiObject>;
  addMessageListener: (listener: Function) => void;
  removeMessageListener: (listener: Function) => void;
  queue: Object[];
  stream?: Duplex;
  createStream: (setupCallback?: Function) => Duplex;
}

function createServer (localApi: IAsyncApiObject): ICapnode {
  const capnode = createCapnode()
  capnode.serializeLocalApi(localApi)
  capnode.nick = 'SERVER'
  return capnode
}

function createClient (remoteApi: ISerializedAsyncApiObject, sendMessage: Function): ICapnode {
  const capnode = createCapnode()
  capnode.nick = 'CLIENT'
  capnode.deserializeRemoteApi(remoteApi)
  capnode.addMessageListener(sendMessage)
  return capnode
}

function createStreamingServer(localApi: IAsyncApiObject) : ICapnode {
  const capnode = createServer(localApi)
  capnode.nick = 'SERVER'
  const local = capnode.createStream()
  const serializedApi = capnode.getSerializedLocalApi()
  capnode.stream = local
  local.push({ type: 'init', value: serializedApi })
  return capnode
}

function createClientFromStream (stream: Duplex): Promise<ICapnode> {
  const capnode = createCapnode()
  capnode.nick = 'CLIENT'

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

function createCapnode() : ICapnode {
  return new Capnode();
}

type IResolver = {
  res: Function;
  rej: Function;
}

class Capnode implements ICapnode {

  private localMethods: { [name:string]: IAsyncFunction } = {};
  private remoteMethods: Object = {};
  private promiseResolvers: Map<string, IResolver> = new Map();
  private localApi?: ISerializedAsyncApiObject;
  private remoteApi: IAsyncApiObject = {};
  public nick: string = 'UNINITIALIZED';

  // Local event listeners, broadcasting locally called functions
  // to their remote hosts.
  private listeners: Set<Function> = new Set();
  private stream?: Duplex;
  private streamReading: boolean = false;
  private queue: Object[] = [];

  getSerializedLocalApi (): ISerializedAsyncApiObject | undefined {
    return this.localApi;
  }

  async getDeserializedRemoteApi () {
    return this.remoteApi;
  }

  setStream (_stream: Duplex) {
    this.stream = _stream;
  }

  private processMessage (message: ICapnodeMessage) {
    let resolver
  
    switch (message.type) {
  
      // For initially receiving a remote interface:
      case 'init':
        deserialize(message.value)
        break;
  
      case 'invocation':
        if (typeof message.methodId === 'undefined') {
          throw new Error('Invalid message.');
        }
        const method:IAsyncFunction = this.localMethods[message.methodId];
        const deserializedArgs = (message.arguments || []).map(deserialize)
        method(...deserializedArgs)
        .then((reply) => {
          const response: ICapnodeMessage = {
            type: 'return',
            methodId: message.replyId,
            value: reply,
          }
          sendMessage(response)
        })
        .catch((reason) => {
          const response: ICapnodeMessage = {
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
        if (typeof message.methodId !== 'string') {
          throw new Error('Invalid message.');
        }
        resolver = this.promiseResolvers.get(message.methodId)
        if (!resolver) {
          throw new Error('Method id not found: ' + message.methodId);
        }
        const { res } = resolver
 
        return res(message.value)
        break
  
      case 'error':
        if (typeof message.methodId !== 'string') {
          throw new Error('Invalid message.');
        }
        resolver = this.promiseResolvers.get(message.methodId)
        if (!resolver) {
          throw new Error('Method id not found: ' + message.methodId);
        }
        const { rej } = resolver
        return rej(message.value)
        break
  
      default:
        throw new Error ('Unknown message type: ' + message.type)
    }
  }

  createStream (setup?: Function): Duplex {
    const stream = new Duplex({
      objectMode: true,
      write: (chunk, _encoding, cb) => {
        try {
          this.receiveMessage(chunk)
          if (setup && chunk.type === 'init') {
            setup(chunk)
          }
        } catch (err) {
          return cb(err)
        }
        cb()
      },
      read: (_size) => {
        this.streamReading = true;

        // recipient is ready to have messages pushed.
        if (this.queue.length > 0) {
          let next = this.queue.shift()
          while (this.stream && this.stream.push(next)) {
            next = this.queue.shift()
          }

          if (this.queue.length > 0) {
            // Recipient is overloaded, resume queueing:
            this.streamReading = false;
          }
        }
      }
    })

    this.setStream(stream)
    return stream
  }

  receiveMessage (message: ICapnodeMessage) {
    this.processMessage(message);
  }

  addMessageListener (func:Function ) {
    if (func && typeof func === 'function') {
      this.listeners.add(func)
    }
  }

  removeMessageListener (func: Function) {
    this.listeners.delete(func)
  }

  sendMessage (message: ICapnodeMessage) {
    if (this.stream) {
      if (this.streamReading) {
        this.stream.push(message)
      } else {
        this.queue.push(message)
      }
    }

    this.listeners.forEach((listener: Function) => {
      listener(message);
    })
  }

  serializeLocalApi (obj: IAsyncApiObject) {
    this.localApi = this.serialize(obj);
    return this.localApi;
  }

  serialize (obj: IAsyncApiObject, res: Object = {}): ISerializedAsyncApiObject {
    return serializeWithReg(this.localMethods, obj, this.deserialize, res);
  }

  deserialize (obj: ISerializedAsyncApiObject, res: Object = {}) {
    return deserializeRemoteData(obj, this.remoteMethods, this.promiseResolvers, res, this.sendMessage, this.serialize)
  }

  deserializeRemoteApi (serialized: ISerializedAsyncApiObject): IAsyncApiObject {
    const deserialized = this.deserialize(serialized);
    this.remoteApi = deserialized
    return this.remoteApi;
  }

}

