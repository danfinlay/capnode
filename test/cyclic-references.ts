import test from 'tape';
import Capnode from '../index';
import { IAsyncApiObject } from '../src/@types/index';

test('serializing cyclic objects', async (t) => {


  /**
   * As demonstrated here:
   * https://github.com/ajvincent/es-membrane/#the-concepts-driving-a-membrane
   */
  const x: IAsyncApiObject = { foo: 'bar' };
  const y = { x };
  x.y = y;

  const cap = new Capnode({
    index: x,
    nickname: 'cap1',
  });

  const cap2 = new Capnode({ nickname: 'cap2' });

  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();

  remote.addRemoteMessageListener((message) => remote2.receiveMessage(message));
  remote2.addRemoteMessageListener((message) => remote.receiveMessage(message));

  try {
    const remoteX: any = await cap2.requestIndex(remote2);
    t.ok(remoteX, 'Remote is constructed.')

    const remoteY = remoteX.y;
    t.equal(remoteX, remoteY.x, 'The remote object is also cyclic.');
  } catch (err) {
    t.error(err);
  }

  t.end();
});
