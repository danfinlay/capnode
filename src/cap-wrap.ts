import { IAsyncApiValue, IApiValue } from "./@types";
import Capnode from '../';

export default async function capWrap (api: IApiValue): Promise<IAsyncApiValue> {
  const cap = new Capnode({ index: api });
  const cap2 = new Capnode({});
  const remote = cap.createRemote();
  const remote2 = cap2.createRemote();
  remote.pipe(remote2).pipe(remote)
  return cap2.requestIndex(remote2);
}
