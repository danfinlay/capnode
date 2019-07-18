import Remote from './remote';
import { Duplex } from 'stream';

export default function streamFromRemote (remote: Remote): Duplex {
  return remote;
}
