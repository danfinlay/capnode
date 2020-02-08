import test from 'tape';
import Capnode from '../index';
import { IAsyncApiObject, IAsyncApiValue, IRemoteFunction, IRemoteAsyncMethod } from '../src/@types/index';
require ('../src/serializers/default.test');
require('./streaming');
require('./capWrap');

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

  // A capnode is made a server by receiving an API as its index:
  const cap = new Capnode({
    index: api,
    nickname: 'cap1',
  });

  // A client is created, perhaps in another process:
  const cap2 = new Capnode({ nickname: 'cap2' });

  // Each capnode creates a remote, representing its connection to the other:
  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  // Each remote is given a method to send messages to the other:
  remote.addRemoteMessageListener((message) => remote2.receiveMessage(message));
  remote2.addRemoteMessageListener((message) => remote.receiveMessage(message));

  try {
    // We can now request the index from cap1 on cap2:
    const remoteApi: any = await cap2.requestIndex(remote2);
 
    // Notice they are not the same objects:
    t.notEqual(remoteApi, api, 'Api objects are not the same object.');

    // They do, however, share the same properties and tyeps:
   Object.keys(remoteApi).forEach((key) => {
      t.ok(key in api, 'The original api has the key ' + key);
      t.equal(typeof remoteApi[key], typeof api[key], 'The values are the same type');

      // Other than functions, they are even the same value:
      if (typeof remoteApi[key] !== 'function') {
        t.equal(remoteApi[key], api[key]);
      }
    })

    // We can even call the functions provided:
    const result = await remoteApi.baz();
    t.equal(result, 'bam');

  } catch (err) {
    t.error(err);
  }

  t.end();
})

test('creating an event emitter', async (t) => {

  /**
   * We want to support passing functions as arguments to remote functions.
   * 
   * In this example, we subscribe to a method that will call our listener function
   * after 100 ms.
   */
  const api: IAsyncApiObject = {
    subscribe: async (listener) => {
      setTimeout(() => {
        try {
          if (listener && typeof listener === 'function') {
            listener('foo');
          } else {
            t.fail('listener was no good:' + listener);
          }
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
      t.end();
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
  const api: IAsyncApiObject = {
    subscribe: async (listener) => {
      setTimeout(() => {
        try {
          if (typeof listener === 'function') {
            listener('foo');
          } else {
            t.fail('listener was no good: ' + listener);
          }
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
      t.end();
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
  const api: IAsyncApiObject = {
    greet: async (greeting) => {
      if (greeting === 'how do you do?') {
        return {
          value: 'very well, and you?',
          reply: async (theirState: string) => {
            t.equal(theirState, 'jolly well indeed.');
            t.end();
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
      if (!emitter || typeof emitter !== 'object' || !('on' in emitter) || typeof emitter.on !== 'function') {
        t.fail('emitter is no good ' + emitter);
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
    const remoteApi: any = await cap2.requestIndex(remote2);

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

    await remoteApi.receiveEvents(emitter);

  } catch (err) {
    t.error(err);
  }

  t.end();
})

test('third party method reconstruction', async (t) => {

  /**
   * The API we want to make available over a serializable async boundary
   * like a network, process, or other context:
   */
  const api: IAsyncApiObject = {
    foo: 'bar',
    baz: async () => 'bam',
    bork: undefined,
  }

  // A capnode is made a server by receiving an API as its index:
  const host = new Capnode({
    index: api,
    nickname: 'host',
  });

  // A client is created, perhaps in another process:
  const client1 = new Capnode({ nickname: 'client1' });

  // A third party is created, a friend to receive a delegation:
  const client2 = new Capnode({ nickname: 'client2' });

  // Each capnode creates a remote, representing its connection to the other:
  // Host makes two connections, one for each connected peer:
  const hostRemote = host.createRemote();
  const hostRemote2 = host.createRemote();

  const clientRemote1 = client1.createRemote();
  const clientRemote2 = client2.createRemote();

  // First client connects to host
  hostRemote.addRemoteMessageListener((message) => clientRemote1.receiveMessage(message));
  clientRemote1.addRemoteMessageListener((message) => hostRemote.receiveMessage(message));

  // client2 connects to host
  hostRemote2.addRemoteMessageListener((message) => clientRemote2.receiveMessage(message));
  clientRemote2.addRemoteMessageListener((message) => hostRemote2.receiveMessage(message));

  try {
    // We can now request the index from cap1 on cap2:
    const remoteApi: any = await client1.requestIndex(clientRemote1);

    const baz: IRemoteAsyncMethod = remoteApi.baz;
    const bazId = baz.capId;

    const baz2 = clientRemote2.reconstruct(bazId || '');

    // Notice they are not the same objects:
    t.notEqual(baz, baz2, 'Api objects are not the same object.');

    // We should be able to normally call reconstructed objects:
    const result = await baz2();
    t.equal(result, 'bam');

  } catch (err) {
    t.error(err);
  }

  t.end();
})
