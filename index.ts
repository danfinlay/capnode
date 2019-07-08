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

export interface ILocalMethodRegistry {
  remoteApi: IAsyncApiObject;
  localApi?: ISerializedAsyncApiObject;
}

export default class Capnode {

}
