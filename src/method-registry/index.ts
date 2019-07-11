import {
  IAsyncFunction,
} from '../@types/index';
const cryptoRandomString = require('crypto-random-string');
const k_BYTES_OF_ENTROPY = 20

type IResolver = {
  res: Function,
  rej: Function,
}

export class MethodRegistry {
  private methodMap: Map<string, IAsyncFunction> = new Map();
  private reverseMap: Map<IAsyncFunction, string> = new Map();
  private pendingPromises: Map<string, IResolver> = new Map();

  registerFunction (method: IAsyncFunction): string {
    const oldId = this.reverseMap.get(method);
    if (oldId && typeof oldId === 'string') {
      console.log('old ID identified', oldId);
      this.methodMap.set(oldId, method);
      this.reverseMap.set(method, oldId);
      return oldId;
    }

    const id = random();
    this.methodMap.set(id, method);
    this.reverseMap.set(method, id);
    return id;
  }

  getFunction (methodId: string): IAsyncFunction | undefined {
    return this.methodMap.get(methodId);
  }

  getId (method: IAsyncFunction): string | undefined { 
    return this.reverseMap.get(method);
  }

  registerPromise(promiseId: string, res: Function, rej: Function) {
    this.pendingPromises.set(promiseId, { res, rej });
  }

  getResolvers(promiseId: string): IResolver | undefined {
    return this.pendingPromises.get(promiseId);
  }

  clearResolvers(promiseId: string): void {
    this.pendingPromises.delete(promiseId);
  }

}

function random () {
  return cryptoRandomString(k_BYTES_OF_ENTROPY)
}
