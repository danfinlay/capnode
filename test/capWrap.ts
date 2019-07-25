import test from 'tape';
import Capnode, { capWrap } from '../index';
import { IAsyncApiObject, IAsyncFunction, IAsyncApiValue, IRemoteFunction, IApiValue, IApiObject } from '../src/@types/index';
require ('../src/serializers/default.test');
require('./streaming');

test('basic serialization and api reconstruction', async (t) => {

  /**
   * The API we want to make available over a serializable async boundary
   * like a network, process, or other context:
   */
  const api: IAsyncApiObject = {
    foo: 'bar',
    baz: async () => 'bam',
    bork: undefined,
  }

  try {
    // We can now request the index from cap1 on cap2:
    const remoteApi: IAsyncApiValue = await capWrap(api);
 
    // Notice they are not the same objects:
    t.notEqual(remoteApi, api, 'Api objects are not the same object.');

    if (typeof remoteApi !== 'object' || Array.isArray(remoteApi)) {
      t.fail('did not return an object');
      return t.end();
    }

    // They do, however, share the same properties and tyeps:
    Object.keys(remoteApi).forEach((key: string) => {
      t.ok(key in api, 'The original api has the key ' + key);

      if (typeof remoteApi !== 'object') {
        t.fail('did not return an object');
        return t.end();
      }

      if (typeof key !== 'string') {
        t.fail('key was not a string');
        return t.end();
      }

      if (!(key in api)
        || !(key in remoteApi)
      ) {
        t.fail(`Key ${key} was not found in returned api`);
        return t.end();
      }

      t.equal(typeof remoteApi[key], typeof api[key], 'The values are the same type');

      // Other than functions, they are even the same value:
      if (typeof remoteApi[key] !== 'function') {
        t.equal(remoteApi[key], api[key]);
      }
    })

    if (!remoteApi.baz || typeof remoteApi.baz !== 'function') {
      t.fail('baz was not a function');
      return t.end();
    }

    // We can even call the functions provided:
    const result = await remoteApi.baz();
    t.equal(result, 'bam');

  } catch (err) {
    t.error(err);
  }

  return t.end();
})

test('creating an event emitter', async (t) => {

  /**
   * We want to support passing functions as arguments to remote functions.
   * 
   * In this example, we subscribe to a method that will call our listener function
   * after 100 ms.
   */
  const api: IApiObject = {
    subscribe: async (listener: IAsyncFunction) => {
      setTimeout(() => {
        try {
          listener('foo');
        } catch (e) { t.error(e);}
      }, 100)
      return 'OKAY!';
    }
  }

  const cap = new Capnode({
    index: api,
    nickname: 'cap1',
  });

  const cap2 = new Capnode({ nickname: 'cap2' });

  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  remote.addRemoteMessageListener((message) => remote2.receiveMessage(message));
  remote2.addRemoteMessageListener((message) => remote.receiveMessage(message));

  try {
    const remoteApi: any = await cap2.requestIndex(remote2);
    Object.keys(remoteApi).forEach((key) => {
      t.ok(key in api, 'The original api has the key ' + key);
      t.equal(typeof remoteApi[key], typeof api[key], 'The values are the same type');

      if (typeof remoteApi[key] !== 'function') {
        t.equal(remoteApi[key], api[key]);
      }
    })

    // We can even call the functions provided:
    const result = await remoteApi.subscribe(async (result: IAsyncApiValue) => {
      t.equal(result, 'foo', 'The subscription was fired.');
      return t.end();
    });
    t.equal(result, 'OKAY!', 'the result was returned');

  } catch (err) {
    t.error(err);
  }
})

test('passing event emitters around', async (t) => {

  /**
   * We want to support passing functions as arguments to remote functions.
   * 
   * In this example, we subscribe to a method that will call our listener function
   * after 100 ms.
   */
  const api: IApiObject = {
    subscribe: async (listener: IAsyncFunction) => {
      setTimeout(() => {
        try {
          listener('foo');
        } catch (e) { t.error(e);}
      }, 100)
      return 'OKAY!';
    }
  }

  const cap = new Capnode({
    index: api,
    nickname: 'cap1',
  });

  const cap2 = new Capnode({ nickname: 'cap2' });

  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  remote.addRemoteMessageListener((message) => remote2.receiveMessage(message));
  remote2.addRemoteMessageListener((message) => remote.receiveMessage(message));

  try {
    const remoteApi: any = await cap2.requestIndex(remote2);

    Object.keys(remoteApi).forEach((key) => {
      t.ok(key in api, 'The original api has the key ' + key);
      t.equal(typeof remoteApi[key], typeof api[key], 'The values are the same type');

      if (typeof remoteApi[key] !== 'function') {
        t.equal(remoteApi[key], api[key]);
      }
    })

    // We can even call the functions provided:
    const result = await remoteApi.subscribe(async (result: IAsyncApiValue) => {
      t.equal(result, 'foo', 'The subscription was fired.');
      return t.end();
    });
    t.equal(result, 'OKAY!', 'the result was returned');

  } catch (err) {
    t.error(err);
  }
})

test('passing functions back and forth', async (t) => {

  /**
   * There should be no limit to how many functions we can pass back and forth:
   */
  const api: IApiValue = {
    greet: async (greeting: string) => {
      if (greeting === 'how do you do?') {
        return {
          value: 'very well, and you?',
          reply: async (theirState: string) => {
            t.equal(theirState, 'jolly well indeed.');
            return t.end();
          }
        }
      }
    },
  }

  const cap = new Capnode({
    index: api,
    nickname: 'cap1',
  });

  const cap2 = new Capnode({ nickname: 'cap2' });

  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  remote.addRemoteMessageListener((message) => remote2.receiveMessage(message));
  remote2.addRemoteMessageListener((message) => remote.receiveMessage(message));

  try {
    const remoteApi: any = await cap2.requestIndex(remote2);

    const reply = await remoteApi.greet('how do you do?');
    t.ok(reply);

    t.equal(reply.value, 'very well, and you?');
    t.equal(typeof reply.reply, 'function');

    reply.reply('jolly well indeed.');
  } catch (err) {
    t.error(err);
  }
})

/**
 * Since garbage collection only works on unreferenced local functions,
 * we need to provide the `.dealloc()` method on all remote functions to allow consumers
 * to deallocate remote function references.
 * 
 * This will not be necessary after WeakRef is merged into the JS standard.
 */
test('remote deallocation', async (t) => {

  const api: IAsyncApiObject = {
    receiveEvents: async (emitter) => {

      if (!emitter || typeof emitter !== 'object' || !('on' in emitter)
      || !emitter.on || typeof emitter.on !== 'function') {
        t.fail('emitter was malformed');
        return t.end();
      }

      // The emitter side is going to tell this side to deallocate:
      emitter.on('data', (data: string) => {
        t.equal(data, 'foo', 'event is fired correctly.');
      });
    }
  }

  const cap = new Capnode({
    index: api,
    nickname: 'cap1',
  });

  const cap2 = new Capnode({ nickname: 'cap2' });

  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  remote.addRemoteMessageListener((message) => remote2.receiveMessage(message));
  remote2.addRemoteMessageListener((message) => remote.receiveMessage(message));

  try {
    const remoteApi: IAsyncApiValue = await cap2.requestIndex(remote2);

    const listeners: IRemoteFunction[] = [];
    const emitter = {
      on: async (eventName:string, listener:IRemoteFunction) => {
        t.equal(eventName, 'data');
        listeners.push(listener);

        // Emit our event:
        await listener('foo');

        const initialCount = cap.registeredMethodCount;

        // Now we test the dealloc method:
        await listeners[0].dealloc();

        const subsequentCount = cap.registeredMethodCount;
        t.equal(subsequentCount, initialCount - 1, 'The method was deallocated');
      }
    };

    if (!('receiveEvents' in remoteApi) || typeof remoteApi['receiveEvents'] !== 'function') {
      t.fail('remote api lacked subscription method')
      return t.end()
    }
    await remoteApi.receiveEvents(emitter);

  } catch (err) {
    t.error(err);
  }

  return t.end();
})

test('makes functions async', async (t) => {
  const EXPECTED = 'Hello!'
  const func = () => EXPECTED
  console.log('wrapping')
  let func2: IAsyncApiValue = await capWrap(func);
  console.log('wrapped')

  if (func2 && typeof func2 === 'function') {
    func2 = func2 as IAsyncFunction;
  } else {
    t.fail('func2 was malformed'); 
    return t.end();
  }

  const result = await func2();
  t.equal(result, EXPECTED, 'Made function async.')
  const result2 = func2();
  t.notEqual(result2, EXPECTED, 'returns a promise');
  t.ok(result2 instanceof Promise, 'is a promise');
  t.end();
})
