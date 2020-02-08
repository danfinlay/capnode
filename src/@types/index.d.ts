import { MethodRegistry } from "../method-registry";
import { SerializedFormat, IRemoteAsyncMethod } from "../serializers/default";
export { IRemoteAsyncMethod } from "../serializers/default";

export type IAsyncFunction = (...args: IApiValue[]) => Promise<IApiValue>;
export interface IAsyncApiObject {
    [key: string]:  IAsyncApiValue,
}
export interface IAsyncArray extends Array<IAsyncApiValue> {}
export type IPrimitiveValue = string | number | boolean | undefined | void;
export type IAsyncApiValue = IAsyncApiObject | IAsyncFunction | IPrimitiveValue | IAsyncArray;


export interface IApiArray extends Array<IApiValue> {}
export interface IApiObject {
    [key: string]:  IApiValue,
};
export type IApiValue = IApiObject | Function | IPrimitiveValue | IApiArray;

export interface IRemoteFunction extends IAsyncFunction {
  dealloc: Function;
}
export type IAsyncType = IAsyncApiValue | IAsyncApiValue[];

export type ICapnodeMessageSender = (message: ICapnodeMessage) => void;

export type ICapnodeMessage = IInvocationMessage | IIndexMessage | IErrorMessage | IReturnMessage | IDeallocMessage;

export type ICapnodeMessageAbstract = {
  type: 'index' | 'invocation' | 'error' | 'return' | 'dealloc';
  value?: any;
  arguments?: SerializedFormat;
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

export type ISerializedAsyncApiObject = string | number | boolean | object | Array<any> | undefined;

export interface ICapnodeSerializer {
  serialize: (message: IApiValue, registry: MethodRegistry) => unknown;
  deserialize: (data: any, registry: MethodRegistry, sendMessage: ICapnodeMessageSender) => IAsyncApiValue;
  deserializeFunction: (methodId: string, registry: MethodRegistry, sendMessage: ICapnodeMessageSender) => IRemoteAsyncMethod; 
}
