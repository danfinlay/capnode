import { ICapnodeMessageSender, ICapnodeMessage } from "./@types";
import { Duplex } from 'stream';

/**
 * The Remote class is used to represent a single connection to a Capnode host.
 * It caches all information related to that remote agent in one object,
 * making for easy deallocation at the time of disconnect.
 * 
 * @property messageHandler - The method used by the local capnode instance to send its messages to this remote instance.
 * 
 */
export default class Remote extends Duplex {
  private localMessageListeners: Set<ICapnodeMessageSender> = new Set();
  private remoteMessageListeners: Set<ICapnodeMessageSender> = new Set();
  private streamReading = false;
  private queue: ICapnodeMessage[] = [];

  constructor(messageHandler?: ICapnodeMessageSender) {
    super({
      objectMode: true,
      write: (message: ICapnodeMessage, _encoding, cb: (err?: Error) => void) => {
        if (!message) {
          return cb();
        }
        try {
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
          while (this.push(next)) {
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

    if (messageHandler) {
      this.addLocalMessageListener(messageHandler);
    }
  }

  sendMessageOverStream(outbound: ICapnodeMessage) {
    if (this.streamReading) {
      this.push(outbound);
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
}
