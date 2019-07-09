import { MethodRegistry } from "./src/method-registry";

export type IAsyncApiObject = { [key: string]: IAsyncApiValue };
export type IAsyncFunction = (...args: IAsyncApiObject[]) => Promise<IAsyncApiValue>;
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

export default class Capnode {
  private registry: MethodRegistry;

  constructor({ registry = new MethodRegistry(), index }: { registry?: MethodRegistry; index?: IAsyncApiObject; }) {
    this.registry = registry;

    if (index) {
      this.addLocalIndex(index);
    }
  }

  addLocalIndex (index: IAsyncApiValue): void {
    this.registerAnyFunctions(index);
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

}
