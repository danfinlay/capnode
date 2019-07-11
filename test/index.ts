import test from 'tape';
import Capnode, { IAsyncApiObject } from '../index';
require ('../src/serializers/default.test');

test('basic serialization and deserialization', async (t) => {
  const api: IAsyncApiObject = {
    foo: 'bar',
    baz: async () => 'bam',
  }
  const cap = new Capnode({
    index: api,
  });
  t.ok(cap.index, 'index is present')

  const cap2 = new Capnode({});
  const remote: any = cap2.deserialize(cap.index, (message) => {
    cap.processMessage(message, (outgoing) => {
      console.log('any reply', outgoing);
    });
  });

  console.dir(remote);
  t.ok(remote, 'Remote is constructed.')


    const result = await remote.baz();
    t.equal(result, 'bam');


  t.end();
})
