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

  constructor(messageHandler?: ICapnodeMessageSender) extends Duplex {
    const sendOverStream = this.sendMessageOverStream.bind(this);
    this.sendOverStream = sendOverStream;

    this.addMessageListener(messageHandler);

    super({
      objectMode: true,
      write: (message: ICapnodeMessage, _encoding, cb: (err?: Error) => void) => {
        try {
          this.receiveMessage(message);
        } catch (err) {
          this.removeMessageListener(sendOverStream);
          return cb(err);
        }
        cb();
      },
      read: () => {
        this.streamReading = true;

        // recipient is ready to have messages pushed.
        if (this.queue.length > 0) {
          let next = this.queue.shift()
          while (stream.push(next)) {
            next = this.queue.shift()
          }

          if (this.queue.length > 0) {
            // Recipient is overloaded, resume queueing:
            this.streamReading = false
          }
        }
      }
    });

  }

  function sendMessageOverStream(outbound: ICapnodeMessage) {
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
  addMessageListener (sender?: ICapnodeMessageSender) {
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
    this.informAll(this.localMessageListeners, message);
  }

  emitMessage(message: ICapnodeMessage): void {
    this.informAll(this.remoteMessageListeners, message);
  }



}
