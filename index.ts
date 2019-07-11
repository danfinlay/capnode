import { MethodRegistry } from "./src/method-registry";
import DefaultSerializer from './src/serializers/default';

export type IAsyncApiObject = { [key: string]: IAsyncApiValue };
export type IPrimitiveValue = string | number | boolean;
export type IAsyncAbstractValue = IAsyncApiObject | IAsyncFunction | IPrimitiveValue;
export type IAsyncApiValue = IAsyncApiObject | IAsyncFunction | IPrimitiveValue | Array<IAsyncAbstractValue>;
export type IAsyncFunction = (...args: IAsyncApiValue[]) => Promise<IAsyncApiValue>;
export type IAsyncType = IAsyncApiValue | IAsyncApiValue[];

export type ICapnodeMessageSender = (message: ICapnodeMessage) => void;

export type ICapnodeMessage = IInvocationMessage | IIndexMessage | IErrorMessage | IReturnMessage | IDeallocMessage;

export type ICapnodeMessageAbstract = {
  type: 'index' | 'invocation' | 'error' | 'return' | 'dealloc';
  value?: any;
  arguments?: ISerializedAsyncApiObject[];
  methodId?: string;
  replyId?: string;
};

export interface IInvocationMessage extends ICapnodeMessageAbstract {
  type: 'invocation';
}
export interface IIndexMessage extends ICapnodeMessageAbstract {
  type: 'index';
}
export interface IErrorMessage extends ICapnodeMessageAbstract {
  type: 'error';
}
export interface IReturnMessage extends ICapnodeMessageAbstract {
  type: 'return';
}
export interface IDeallocMessage extends ICapnodeMessageAbstract {
  type: 'dealloc';
}

export type ISerializedAsyncApiObject = string | number | boolean | object | Array<any>;

interface ICapnodeSerializer {
  serialize: (message: IAsyncApiValue, registry: MethodRegistry) => any;
  deserialize: (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender) => IAsyncApiValue;
}

export default class Capnode {
  private registry: MethodRegistry;
  private serializer: ICapnodeSerializer;
  public index: any;

  constructor({ 
    registry = new MethodRegistry(),
    index,
    serializer = new DefaultSerializer(),
  }: {
    registry?: MethodRegistry;
    index?: IAsyncApiObject;
    serializer?: ICapnodeSerializer, 
  }) {
    this.registry = registry;
    this.serializer = serializer;

    if (index) {
      this.addLocalIndex(index);
    }
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

  processMessage (message: ICapnodeMessage, sendMessage: ICapnodeMessageSender): void {
    console.dir('processing message', message);
    switch (message.type) {
      case 'invocation':
        return this.processInvocation(message, sendMessage);
      case 'index':
        return this.processIndex(message, sendMessage);
      case 'return':
        return this.processReturn(message, sendMessage);
      case 'error':
        return this.processError(message, sendMessage);
      case 'dealloc':
        return this.processDealloc(message, sendMessage);
    }
    throw new Error('Unknown message type.')
  }

  processDealloc (message: IDeallocMessage, sendMessage: ICapnodeMessageSender): void {
    console.log('deallocing', message);
    sendMessage(message);
  }

  processReturn (message: IReturnMessage, sendMessage: ICapnodeMessageSender): void {
    console.log('returning', message);
    sendMessage(message);
  }

  processError (message: IErrorMessage, sendMessage: ICapnodeMessageSender): void {
    console.log('erroring', message);
    sendMessage(message);
  }

  processIndex (message: IIndexMessage, sendMessage: ICapnodeMessageSender): void {
    console.log('processing index req', message);
    sendMessage(message);
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
