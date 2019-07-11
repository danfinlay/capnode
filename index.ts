import { MethodRegistry } from "./src/method-registry";
import DefaultSerializer from './src/serializers/default';
import Remote from './src/remote';
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
  ISerializedAsyncApiObject,
 } from './src/@types/index.d';

export { Remote };

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
    const remote = new Remote();
    remote.addMessageListener((message: ICapnodeMessage) => {
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
    return this.serializer.deserialize(value, this.registry, sendMessage);
  }

  processMessage (message: ICapnodeMessage, remote: Remote): void {
    console.log(`${this.nickname} processing message ${message.type}`);
    switch (message.type) {
      case 'invocation':
        return this.processInvocation(message, remote.sendMessage);
      case 'index':
        return this.processIndex(remote.sendMessage);
      case 'return':
        return this.processReturn(message, remote);
      case 'error':
        return this.processError(message);
      case 'dealloc':
        return this.processDealloc(message, remote.sendMessage);
    }
    throw new Error('Unknown message type.')
  }

  processDealloc (message: IDeallocMessage, sendMessage: ICapnodeMessageSender): void {
    console.log('deallocing', message);
    sendMessage(message);
  }

  processReturn (message: IReturnMessage, remote: Remote): void {
    if (!message.methodId || typeof message.methodId !== 'string') {
      throw new Error('Missing methodId parameter.');
    }
    const resolver = this.registry.getResolvers(message.methodId);
    if (resolver && resolver.res) {
      resolver.res(this.deserialize(message.value, remote.sendMessage.bind(remote)));
      this.registry.clearResolvers(message.methodId);
    } else {
      throw new Error('Unknown method.');
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

  processIndex (sendMessage: ICapnodeMessageSender): void {
    sendMessage(this.index);
  }

  processInvocation (message: IInvocationMessage, sendMessage: ICapnodeMessageSender): void {
    if (!message.methodId) {
      throw new Error('Invocation requires a methodId');
    }

    const method = this.registry.getFunction(message.methodId);

    if (!method)  {
      throw new Error('Invocation requires a valid methodId');
    }

    let deserializedArgs: IAsyncApiValue[] = [];
    if (message.arguments) {
      deserializedArgs = message.arguments.map((arg: ISerializedAsyncApiObject) => {
        return this.serializer.deserialize(arg, this.registry, sendMessage);
      });
    }

    method(...deserializedArgs)
    .then((reply: IAsyncApiValue) => {
      const response: IReturnMessage = {
        type: 'return',
        methodId: message.replyId,
        value: this.serialize(reply),
      };
      sendMessage(response);
    })
    .catch((reason: Error) => {
      const response: IErrorMessage = {
        type: 'error',
        methodId: message.replyId,
        value: {
          message: reason.message,
          stack: reason.stack,
        },
      };
      sendMessage(response);
    })

  }

}
