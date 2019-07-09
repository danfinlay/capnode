const assert = require('assert');
import test from 'tape';
import Capnode from '../index';

console.log('okayy....')
test('basic serialization', (t: { end: () => void; }) => {
  const api = {
    foo: 'bar',
    baz: async () => 'bam',
  }
  const cap = new Capnode({});
  cap.addLocalIndex(api);

  assert(cap, 'okay!');
  t.end();
})
