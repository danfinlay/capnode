import test from 'tape';
import Capnode from '../index';

console.log('okayy....')
test('basic serialization', (t) => {
  const api = {
    foo: 'bar',
    baz: async () => 'bam',
  }
  const cap = new Capnode({
    index: api,
  });

  console.dir(cap.index)
  t.ok(cap.index, 'index is present')
  t.end();
})
