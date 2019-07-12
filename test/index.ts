import test from 'tape';
import Capnode from '../index';
import { IAsyncApiObject } from '../src/@types/index';
require ('../src/serializers/default.test');

test('basic serialization and deserialization', async (t) => {

  /**
   * The API we want to make available over a serializable async boundary
   * like a network, process, or other context:
   */
  const api: IAsyncApiObject = {
    foo: 'bar',
    baz: async () => 'bam',
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
    t.ok(remoteApi, 'Remote is constructed.')

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
