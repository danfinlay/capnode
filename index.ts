import { MethodRegistry } from "./src/method-registry";
import DefaultSerializer from './src/serializers/default';

export type IAsyncApiObject = { [key: string]: IAsyncApiValue };
export type IAsyncFunction = (...args: IAsyncApiObject[]) => Promise<IAsyncApiValue>;
export type IPrimitiveValue = string | number | boolean;
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

interface ICapnodeSerializer {
  serialize: (message: IAsyncApiValue, registry: MethodRegistry) => any;
  deserialize: (data: any, registry: MethodRegistry) => IAsyncApiValue;
}

export default class Capnode <SerializedFormat> {
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
        Object.keys(value).forEach((key:string) => {
          this.registerAnyFunctions(value[key]);
        });
        break;
    }
  }

  registerFunction (func: IAsyncFunction) {
    this.registry.registerFunction(func);
  }

  serialize(value: IAsyncApiValue): SerializedFormat {
    return this.serializer.serialize(value, this.registry);
  }

}
