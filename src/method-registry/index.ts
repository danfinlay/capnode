import {
  IAsyncApiObject,
  IAsyncApiValue,
  IAsyncFunction,
  ICapnode,
  ICapnodeDeserializer,
  ICapnodeMessage,
  ICapnodeSerializer,
  ISerializedAsyncApiObject,
  ICapnodeEncoder,
} from '../../index';

interface IMethodRegistry {
  api: IAsyncApiObject;
  serialized: ISerializedAsyncApiObject;
}

export class MethodRegistry implements IMethodRegistry {
  public api: IAsyncApiObject;
  public serialized: ISerializedAsyncApiObject;
  constructor ({ encoder, api, serialized }: { encoder: ICapnodeEncoder; api?: IAsyncApiObject; serialized?: ISerializedAsyncApiObject; }) {
    if (!api && !serialized) {
      throw new Error('Method registry requires either an API or serialized API object to construct.');
    }
    if (api) {
      this.api = api;
      this.serialized = encoder.encode(api);
    }
    if (!api && serialized) {
      this.api = encoder.decode(serialized);
    }
  }
}

