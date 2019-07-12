import { MethodRegistry } from "../method-registry";

export type IAsyncApiObject = { [key: string]: IAsyncApiValue };
export type IPrimitiveValue = string | number | boolean | undefined;
export type IAsyncAbstractValue = IAsyncApiObject | IAsyncFunction | IPrimitiveValue;
export type IAsyncApiValue = IAsyncApiObject | IAsyncFunction | IPrimitiveValue | Array<IAsyncAbstractValue>;
export type IAsyncFunction = (...args: any[]) => Promise<any>;
export interface IRemoteFunction extends IAsyncFunction {
  dealloc: Function;
}
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

export interface ICapnodeSerializer {
  serialize: (message: IAsyncApiValue, registry: MethodRegistry) => any;
  deserialize: (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender) => IAsyncApiValue;
}