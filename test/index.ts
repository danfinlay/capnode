import test from 'tape';
import Capnode from '../index';
import { IAsyncApiObject, ICapnodeMessage } from '../src/@types/index';
require ('../src/serializers/default.test');

test('basic serialization and deserialization', async (t) => {
  const api: IAsyncApiObject = {
    foo: 'bar',
    baz: async () => 'bam',
  }
  const cap = new Capnode({
    index: api,
    nickname: 'cap1',
  });
  t.ok(cap.index, 'index is present')

  const cap2 = new Capnode({ nickname: 'cap2' });

  const remote = cap.createRemote();

  const remoteApi: any = cap2.deserialize(cap.index, (message: ICapnodeMessage) => {
    remote.sendMessage(message);
  });

  console.dir(remoteApi);
  t.ok(remoteApi, 'Remote is constructed.')

  try {
    const result = await remoteApi.baz();
    t.equal(result, 'bam');
  } catch (err) {
    t.error(err);
  }

  t.end();
})
