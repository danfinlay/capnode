const assert = require('assert');
import test from 'tape';
import Capnode from '../index';

console.log('okayy....')
test('test one', (t: { end: () => void; }) => {
  const cap = new Capnode();
  assert(cap, 'okay!');
  t.end();
})
