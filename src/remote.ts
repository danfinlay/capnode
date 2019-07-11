import { ICapnodeMessageSender, ICapnodeMessage } from "./@types";

/**
 * The Remote class is used to represent a single connection to a Capnode host.
 * It caches all information related to that remote agent in one object,
 * making for easy deallocation at the time of disconnect.
 * 
 * @property messageHandler - The method used by the local capnode instance to send its messages to this remote instance.
 * 
 */
export default class Remote {
  private messageListeners: Set<ICapnodeMessageSender> = new Set();
  public sendMessage: ICapnodeMessageSender = this.processMessage.bind(this);

  constructor(messageHandler?: ICapnodeMessageSender) {
    this.addMessageListener(messageHandler);
  }

  /**
   * 
   * @param sender - A Function that will deliver the message to the local capnode.
   * Called when the Remote is constructed within a capnode.
   */
  addMessageListener (sender?: ICapnodeMessageSender) {
    if (!sender) return;
    this.messageListeners.add(sender);
  }

  removeMessageListener (sender: ICapnodeMessageSender) {
    this.messageListeners.delete(sender);
  }

  processMessage(message: ICapnodeMessage): void {
    console.log('processing message', message.type)
    for (let listener of this.messageListeners) {
      listener(message);
    }
  }

}