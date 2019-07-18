import test from 'tape';
import Capnode, { Remote } from '../index';
import { IAsyncApiObject } from '../src/@types/index';

function connectRemotes(remote: Remote, remote2: Remote): void {
  remote.pipe(remote2).pipe(remote);
}

test('Should be able to pass API over stream.', async (t) => {

  const api: IAsyncApiObject = {
    foo: 'bar',
    baz: async () => 'bam',
    bork: undefined,
  }

  const cap = new Capnode({
    index: api,
    nickname: 'cap1',
  });

  const cap2 = new Capnode({ nickname: 'cap2' });

  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  connectRemotes(remote, remote2);

  try {
    const remoteApi: any = await cap2.requestIndex(remote2);
 
    t.notEqual(remoteApi, api, 'Api objects are not the same object.');

    Object.keys(remoteApi).forEach((key) => {
      t.ok(key in api, 'The original api has the key ' + key);
      t.equal(typeof remoteApi[key], typeof api[key], 'The values are the same type');

      if (typeof remoteApi[key] !== 'function') {
        t.equal(remoteApi[key], api[key]);
      }
    })

    const result = await remoteApi.baz();
    t.equal(result, 'bam');

  } catch (err) {
    t.error(err);
  }

  t.end();
});
