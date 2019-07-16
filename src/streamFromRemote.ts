import Remote from './remote';
import { Duplex } from 'stream';
import { ICapnodeMessage } from './@types';

export default function streamFromRemote (remote: Remote): Duplex {
  let streamReading = false;
  const queue: ICapnodeMessage[] = [];

  const stream = new Duplex({
    objectMode: true,
    write: (message: ICapnodeMessage, _encoding, cb: (err?: Error) => void) => {
      try {
        remote.receiveMessage(message);
      } catch (err) {
        remote.removeMessageListener(sendMessageOverStream);
        return cb(err);
      }
      cb();
    },
    read: () => {
      streamReading = true;

      // recipient is ready to have messages pushed.
      if (queue.length > 0) {
        let next = queue.shift()
        while (stream.push(next)) {
          next = queue.shift()
        }

        if (queue.length > 0) {
          // Recipient is overloaded, resume queueing:
          streamReading = false
        }
      }
    }
  })

  function sendMessageOverStream(outbound: ICapnodeMessage) {
    if (stream) {
      if (streamReading) {
        stream.push(outbound);
      } else {
        queue.push(outbound);
      }
    }
  }

  remote.addRemoteMessageListener(sendMessageOverStream);

  return stream;
}
