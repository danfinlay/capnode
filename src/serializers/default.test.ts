import test from 'tape';
import DefaultSerializer from './default';

require ('../serializers/default.test');

test('basic escaping', (t) => {
  const serializer = new DefaultSerializer();

  const input = 'blahblah';
  const escaped = serializer.escape(input);
  const output = serializer.unescape(escaped);

  t.equal(input, output);
  t.end();
})

test('escape sequence escaping', (t) => {
  const serializer = new DefaultSerializer();

  const input = serializer.FUNC_PREFIX + 'blahblah';
  const escaped = serializer.escape(input);
  const output = serializer.unescape(escaped);

  t.notEqual(input, escaped);
  t.equal(input, output);

  t.end();
})

test('weird escape sequence escaping', (t) => {
  const serializer = new DefaultSerializer();
  const fn = serializer.FUNC_PREFIX;

  const input = `${fn}blahblah${fn}haha`;
  const escaped = serializer.escape(input);
  const output = serializer.unescape(escaped);

  t.notEqual(input, escaped);
  t.equal(input, output);

  t.end();
})


