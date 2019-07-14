import test from 'tape';
import DefaultSerializer from './default';
import { MethodRegistry } from '../method-registry';

// require ('../serializers/default.test');

test('serializes and deserializes circular objects', (t) => {
  const serializer = new DefaultSerializer();
  const registry = new MethodRegistry();

  const x: any = {};
  const y = { x }
  x.y = y;

  const input = x;
  const serialized = serializer.serialize(input, registry);
  const output = serializer.deserialize(serialized, registry, noop);

  t.notEqual(input, serialized);
  t.equal(Object.keys(input)[0], Object.keys(output)[0]);
  t.ok(input && input.y && input.y.x);
 if (input && input.y && input.y.x) {
    t.equal(Object.keys(input.y.x)[0], Object.keys(output.y.x)[0]);
  } else {
    t.fail();
  }

  t.equal(input, input.y.x);
  t.equal(output, output.y.x);

  t.end();
});

function noop () {};
