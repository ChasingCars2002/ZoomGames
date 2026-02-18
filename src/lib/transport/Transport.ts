import { GameMessage, TransportMessage } from '../../types/messages';

export type MessageHandler = (message: GameMessage, senderId: string) => void;

export interface Transport {
  readonly clientId: string;
  send(message: GameMessage): void;
  subscribe(handler: MessageHandler): () => void;
  destroy(): void;
}
