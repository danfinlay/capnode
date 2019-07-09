import {
  IAsyncFunction,
} from '../../index';
const cryptoRandomString = require('crypto-random-string');
const k_BYTES_OF_ENTROPY = 20


export class MethodRegistry {
  private methodMap: Map<string, IAsyncFunction> = new Map();
  private reverseMap: Map<IAsyncFunction, string> = new Map();

  registerFunction (method: IAsyncFunction): string {
    const oldId = this.reverseMap.get(method);
    if (oldId && typeof oldId === 'string') {
      return oldId;
    }

    const id = random();
    this.methodMap.set(id, method);
    this.reverseMap.set(method, id);
    return id;
  }
}

function random () {
  return cryptoRandomString(k_BYTES_OF_ENTROPY)
}
