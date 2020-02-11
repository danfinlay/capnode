import { ICapnodeMessageSender, ICapnodeMessage, ICapnodeSerializer } from "./@types";
import { Duplex } from 'stream';
import { IRemoteAsyncMethod } from './serializers/default';
import { MethodRegistry } from "./method-registry";

interface IRemote {
  emitMessage: ICapnodeMessageSender;
}

/**
 * The Remote class is used to represent a single connection to a Capnode host.
 * It caches all information related to that remote agent in one object,
 * making for easy deallocation at the time of disconnect.
 * 
 * @property messageHandler - The method used by the local capnode instance to send its messages to this remote instance.
 * 
 */
export default class Remote extends Duplex implements IRemote {
  private localMessageListeners: Set<ICapnodeMessageSender> = new Set();
  private remoteMessageListeners: Set<ICapnodeMessageSender> = new Set();
  private streamReading = true;
  private queue: ICapnodeMessage[] = [];
  private registry: MethodRegistry | undefined;
  private serializer: ICapnodeSerializer | undefined;

  constructor(messageHandler?: ICapnodeMessageSender, registry?: MethodRegistry, serializer?: ICapnodeSerializer) {
    super({
      write: (stringMessage: string, _encoding, cb: (err?: Error) => void) => {
        if (!stringMessage) {
          return cb();
        }
        try {
          const message = JSON.parse(stringMessage);
          this.receiveMessage(message);
        } catch (err) {
          this.removeMessageListener(this.sendMessageOverStream);
          return cb(err);
        }
        cb();
      },
      read: () => {
        this.streamReading = true;

        const queue = this.queue;
        if (queue.length > 0) {
          let next = queue.shift()
          while (this.push(JSON.stringify(next))) {
            next = queue.shift();
          }

          if (queue.length > 0) {
            this.streamReading = false
          }
        }
      }
    });

    // Connect stream to remote listeners:
    this.sendMessageOverStream = this.sendMessageOverStream.bind(this);
    this.addRemoteMessageListener(this.sendMessageOverStream);
    this.registry = registry;
    this.serializer = serializer;

    if (messageHandler) {
      this.addLocalMessageListener(messageHandler);
    }
  }

  sendMessageOverStream(outbound: ICapnodeMessage) {
    if (this.streamReading) {
      this.push(JSON.stringify(outbound));
    } else {
      this.queue.push(outbound);
    }
  }

  /**
   * @param sender - A Function that will deliver the message to the local capnode.
   * Called when the Remote is constructed within a capnode.
   */
  addLocalMessageListener (sender?: ICapnodeMessageSender) {
    if (!sender) return;
    this.localMessageListeners.add(sender);
  }

  removeMessageListener (sender: ICapnodeMessageSender) {
    this.localMessageListeners.delete(sender);
  }

  /**
   * @param sender - A Function that will deliver the message to the remote capnode.
   * Called when the Remote is constructed within a capnode.
   */
  addRemoteMessageListener (sender?: ICapnodeMessageSender) {
    if (!sender) return;
    this.remoteMessageListeners.add(sender);
  }

  removeRemoteMessageListener (sender: ICapnodeMessageSender) {
    this.remoteMessageListeners.delete(sender);
  }

  informAll(listeners: Set<ICapnodeMessageSender>, message: ICapnodeMessage): void {
    for (let listener of listeners) {
      listener(message);
    }
  }

  receiveMessage(message: ICapnodeMessage): void {
    if (!message) return;
    this.informAll(this.localMessageListeners, message);
  }

  emitMessage(message: ICapnodeMessage): void {
    if (!message) return;
    this.informAll(this.remoteMessageListeners, message);
  }

  reconstruct(methodId: string | undefined): IRemoteAsyncMethod {
    if (methodId === undefined) {
      throw new Error('Reconstructing a remote method requires a methodId.');
    }

    if (!this.serializer || !this.registry) {
      throw new Error('reconstruct requires a serializer and registry.');
    }

    const func = this.serializer.deserializeFunction(methodId, this.registry, this.emitMessage.bind(this));
    return func;
  }
}
