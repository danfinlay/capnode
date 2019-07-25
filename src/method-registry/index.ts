const cryptoRandomString = require('crypto-random-string');
const k_BYTES_OF_ENTROPY = 20

type IResolver = {
  res: Function,
  rej: Function,
}

export class MethodRegistry {
  private indexFuncs: Set<Function> = new Set();
  private methodMap: Map<string, Function> = new Map();
  private reverseMap: Map<Function, string> = new Map();
  public pendingPromises: Map<string, IResolver> = new Map();

  protectFunction (method: Function) {
    this.indexFuncs.add(method);
  }

  unprotectFunction (method: Function) {
    this.indexFuncs.delete(method);
  }

  registerFunction (method: Function): string {
    const oldId = this.reverseMap.get(method);
    if (oldId && typeof oldId === 'string') {
      this.methodMap.set(oldId, method);
      this.reverseMap.set(method, oldId);
      return oldId;
    }

    const id = random();
    this.methodMap.set(id, method);
    this.reverseMap.set(method, id);
    return id;
  }

  getFunction (methodId: string): Function | undefined {
    return this.methodMap.get(methodId);
  }

  deallocFunction (methodId: string): void {
    const func = this.getFunction(methodId);
    if (func) {
      if (this.indexFuncs.has(func)) {
        // This is a protected func, do nothing.
        return;
      }
      this.methodMap.delete(methodId);
      this.reverseMap.delete(func);
    }
  }

  getId (method: Function): string | undefined { 
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

  get registeredMethodCount(): number {
    return this.methodMap.size;
  }

}

function random () {
  return cryptoRandomString(k_BYTES_OF_ENTROPY)
}
