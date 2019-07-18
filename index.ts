import { MethodRegistry } from "./src/method-registry";
import DefaultSerializer from './src/serializers/default';
import Remote from './src/remote';
import streamFromRemote from './src/streamFromRemote';

import { 
  ICapnodeMessage,
  ICapnodeSerializer,
  IAsyncApiObject,
  IAsyncApiValue,
  IAsyncFunction,
  ICapnodeMessageSender,
  IDeallocMessage,
  IReturnMessage,
  IErrorMessage,
  IInvocationMessage,
  IIndexMessage,
 } from './src/@types/index.d';

const cryptoRandomString = require('crypto-random-string');
const k_BYTES_OF_ENTROPY = 20;

export { Remote, streamFromRemote };

export default class Capnode {
  private registry: MethodRegistry;
  private serializer: ICapnodeSerializer;
  public index: any;
  public nickname?: string;
  private remotes: Set<Remote> = new Set();

  constructor({ 
    registry = new MethodRegistry(),
    index,
    serializer = new DefaultSerializer(),
    nickname = 'capnode',
  }: {
    registry?: MethodRegistry;
    index?: IAsyncApiObject;
    serializer?: ICapnodeSerializer, 
    nickname?: string,
  }) {
    this.registry = registry;
    this.serializer = serializer;
    this.nickname = nickname;

    if (index) {
      this.addLocalIndex(index);
    }
  }

  createRemote(): Remote {
    const remote = new Remote((message: ICapnodeMessage) => {
      this.processMessage(message, remote);
    });
    this.remotes.add(remote);
    return remote;
  }

  clearRemote(remote: Remote): void {
    this.remotes.delete(remote);
  }

  addLocalIndex (index: IAsyncApiValue): void {
    this.registerAnyFunctions(index);
    this.index = this.serialize(index);
    return this.index;
  }

  registerAnyFunctions (value: IAsyncApiValue): void {
    switch (typeof value) {
      case 'function':
        this.registerFunction(value);
        break;
      case 'object':
        if (Array.isArray(value)) {
          value.forEach((item: IAsyncApiValue) => {
            this.registerAnyFunctions(item);
          })          
        } else {
          Object.keys(value).forEach((key:string) => {
            if (key && key in value) {
              this.registerAnyFunctions(value[key]);
            }
          });
        }
        break;
    }
  }

  registerFunction (func: IAsyncFunction) {
    this.registry.registerFunction(func);
  }

  serialize(value: IAsyncApiValue): any {
    return this.serializer.serialize(value, this.registry);
  }

  deserialize(value: any, sendMessage: ICapnodeMessageSender): IAsyncApiValue {
    if (!value) return;
    return this.serializer.deserialize(value, this.registry, sendMessage);
  }

  processMessage (message: ICapnodeMessage, remote: Remote): void {
    if (!message) return;

    const emitMessage = remote.emitMessage.bind(remote);
    switch (message.type) {
      case 'invocation':
        return this.processInvocation(message, emitMessage);
      case 'index':
        return this.processIndex(message, emitMessage);
      case 'return':
        return this.processReturn(message, emitMessage);
      case 'error':
        return this.processError(message);
      case 'dealloc':
        return this.processDealloc(message, emitMessage);
    }
    throw new Error('Unknown message type.')
  }

  processDealloc (message: IDeallocMessage, sendMessage: ICapnodeMessageSender): void {
    if (!message.methodId || typeof message.methodId !== 'string') {
      throw new Error('Missing methodId parameter.');
    }

    this.registry.deallocFunction(message.methodId);
    const reply: IReturnMessage = {
      type: 'return',
      methodId: message.replyId,
    }
    sendMessage(reply);
  }

  processReturn (message: IReturnMessage, sendMessage: ICapnodeMessageSender): void {
    if (!message.methodId || typeof message.methodId !== 'string') {
      throw new Error('Missing methodId parameter.');
    }
    const resolver = this.registry.getResolvers(message.methodId);
    if (resolver && resolver.res) {
      resolver.res(this.deserialize(message.value, sendMessage)); 
      this.registry.clearResolvers(message.methodId);
    } else {
      throw new Error('Unable to find return resolver.');
    }
  }

  processError (message: IErrorMessage): void {
    if (!message.methodId || typeof message.methodId !== 'string') {

      throw new Error('Missing methodId parameter.');
    }
    const resolver = this.registry.getResolvers(message.methodId);
    if (resolver && resolver.rej) {
      resolver.rej(message);
      this.registry.clearResolvers(message.methodId);
    } else {
      throw new Error('Unknown method.');
    }
  }

  processIndex (message: IIndexMessage, sendMessage: ICapnodeMessageSender): void {
    if (!message.methodId || typeof message.methodId !== 'string') {
      throw new Error('Missing methodId parameter.');
    }

    sendMessage({
      type: 'return',
      methodId: message.methodId,
      value: this.index,
    });
  }

  processInvocation (message: IInvocationMessage, sendMessage: ICapnodeMessageSender): void {
    const self = this;
    if (!message.methodId) {
      throw new Error('Invocation requires a methodId');
    }

    const method = this.registry.getFunction(message.methodId);

    if (!method)  {
      throw new Error('Invocation requires a valid methodId');
    }

    let deserializedArgs: IAsyncApiValue = [];
    if (message.arguments) {
      deserializedArgs = this.serializer.deserialize(message.arguments, this.registry, sendMessage);
    }

    if (!Array.isArray(deserializedArgs)) {
      throw new Error('arguments must be in array form.');
    }

    const result = method(...deserializedArgs)
    if (!(result instanceof Promise)) {
      resolve(result);
      return;
    }

    result
    .then(resolve)
    .catch(reject);

    function resolve (reply: any) {
      const response: IReturnMessage = {
        type: 'return',
        methodId: message.replyId,
        value: self.serialize(reply),
      };
      sendMessage(response);
    }

    function reject (reason: Error) {
      const response: IErrorMessage = {
        type: 'error',
        methodId: message.replyId,
        value: {
          message: reason.message,
          stack: reason.stack,
        },
      };
      sendMessage(response);

    }

  }

  requestIndex(remote: Remote): Promise<IAsyncApiObject> {
    if (!remote) return this.index;

    return new Promise((res, rej) => {
      const methodId:string = random();
      this.registry.registerPromise(methodId, res, rej);

      remote.emitMessage({
        type: 'index',
        methodId,
      });
    });
  }

  get registeredMethodCount(): number {
    return this.registry.registeredMethodCount;
  }

}

function random () {
  return cryptoRandomString(k_BYTES_OF_ENTROPY)
}