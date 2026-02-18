import { GameMessage, TransportMessage } from '../../types/messages';
import { Transport, MessageHandler } from './Transport';

export class BroadcastTransport implements Transport {
  readonly clientId: string;
  private channel: BroadcastChannel;
  private handlers: Set<MessageHandler> = new Set();

  constructor(roomCode: string) {
    this.clientId = crypto.randomUUID();
    this.channel = new BroadcastChannel(`zoomgames-${roomCode}`);
    this.channel.onmessage = (event: MessageEvent<TransportMessage>) => {
      const { senderId, message } = event.data;
      if (senderId === this.clientId) return;
      this.handlers.forEach((handler) => handler(message, senderId));
    };
  }

  send(message: GameMessage): void {
    const transportMsg: TransportMessage = {
      senderId: this.clientId,
      timestamp: Date.now(),
      message,
    };
    this.channel.postMessage(transportMsg);
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  destroy(): void {
    this.handlers.clear();
    this.channel.close();
  }
}
