import { GameMessage, TransportMessage } from '../../types/messages';
import { Transport, MessageHandler } from './Transport';

/**
 * PeerJSTransport – real-time cross-device transport built on PeerJS / WebRTC.
 *
 * Architecture
 * ───────────
 * When the HOST creates a room their PeerJS peer-id IS the room code (6-char
 * uppercase alphanumeric).  Every joiner creates their own Peer and then opens
 * a DataConnection back to the host peer-id (== room code).
 *
 * The host keeps a Map of all inbound connections and fans every outgoing
 * message out to all of them (broadcast).  Joiners only hold one connection
 * (to the host) so their send() goes directly to the host who re-broadcasts.
 *
 * This gives us full mesh-like message delivery while only requiring the free
 * PeerJS public signalling server (0.peerjs.com) – no API keys, no account.
 */

declare global {
    interface Window {
          Peer: new (id?: string, opts?: object) => PeerInstance;
    }
}

interface PeerInstance {
    id: string;
    on(event: string, cb: (...args: unknown[]) => void): void;
    connect(peerId: string, opts?: object): DataConnectionInstance;
    destroy(): void;
}

interface DataConnectionInstance {
    peer: string;
    open: boolean;
    on(event: string, cb: (...args: unknown[]) => void): void;
    send(data: unknown): void;
    close(): void;
}

const PEERJS_CDN =
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

function loadPeerJS(): Promise<void> {
    if (window.Peer) return Promise.resolve();
    return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = PEERJS_CDN;
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
    });
}

export class PeerJSTransport implements Transport {
    readonly clientId: string;
    private peer!: PeerInstance;
    private handlers: Set<MessageHandler> = new Set();

  /** connections TO other peers (host keeps many; joiners keep one) */
  private connections: Map<string, DataConnectionInstance> = new Map();

  /** Whether this instance IS the host (room creator) */
  private _isHost: boolean;

  private _ready: Promise<void>;

  constructor(roomCode: string, isHost: boolean) {
        this._isHost = isHost;

      // The host's peer id is the room code so joiners know where to connect.
      // Joiners get a random peer id.
      const peerId = isHost ? roomCode : undefined;
        this.clientId = isHost ? roomCode : crypto.randomUUID();

      this._ready = loadPeerJS().then(() => this._init(peerId));
  }

  // Expose the ready promise so callers can await setup completion.
  get ready(): Promise<void> {
        return this._ready;
  }

  private _init(peerId?: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
                this.peer = new window.Peer(peerId, {
                          debug: 0,
                          config: {
                                      iceServers: [
                                        { urls: 'stun:stun.l.google.com:19302' },
                                        { urls: 'stun:global.stun.twilio.com:3478' },
                                                  ],
                          },
                });

                                       this.peer.on('open', (_id: unknown) => {
                                                 resolve();
                                       });

                                       this.peer.on('error', (err: unknown) => {
                                                 console.error('[PeerJSTransport] peer error', err);
                                                 reject(err);
                                       });

                                       // HOST: accept incoming connections from joiners
                                       this.peer.on('connection', (conn: unknown) => {
                                                 const dc = conn as DataConnectionInstance;
                                                 dc.on('open', () => {
                                                             this.connections.set(dc.peer, dc);
                                                 });
                                                 dc.on('data', (raw: unknown) => {
                                                             this._handleIncoming(raw, dc.peer);
                                                 });
                                                 dc.on('close', () => {
                                                             this.connections.delete(dc.peer);
                                                 });
                                                 dc.on('error', () => {
                                                             this.connections.delete(dc.peer);
                                                 });
                                       });
        });
  }

  /** Called by the joiner AFTER the host has created the room */
  connectToHost(hostId: string): Promise<void> {
        return new Promise((resolve, reject) => {
                this._ready.then(() => {
                          const conn = this.peer.connect(hostId, { reliable: true, serialization: 'json' });
                          conn.on('open', () => {
                                      this.connections.set(hostId, conn);
                                      resolve();
                          });
                          conn.on('data', (raw: unknown) => {
                                      this._handleIncoming(raw, hostId);
                          });
                          conn.on('close', () => {
                                      this.connections.delete(hostId);
                          });
                          conn.on('error', (e: unknown) => {
                                      reject(e);
                          });
                });
        });
  }

  private _handleIncoming(raw: unknown, fromPeerId: string): void {
        try {
                const msg = raw as TransportMessage;
                if (msg.senderId === this.clientId) return; // echo guard

          // Deliver to local handlers
          this.handlers.forEach((h) => h(msg.message, msg.senderId));

          // HOST re-broadcasts to all OTHER connections (fan-out)
          if (this._isHost) {
                    this.connections.forEach((conn, peerId) => {
                                if (peerId !== fromPeerId && conn.open) {
                                              conn.send(msg);
                                }
                    });
          }
        } catch (e) {
                console.warn('[PeerJSTransport] bad message', e);
        }
  }

  send(message: GameMessage): void {
        const envelope: TransportMessage = {
                senderId: this.clientId,
                timestamp: Date.now(),
                message,
        };

      if (this._isHost) {
              // Host broadcasts to all connected peers
          this.connections.forEach((conn) => {
                    if (conn.open) conn.send(envelope);
          });
      } else {
              // Non-host sends to host only (host will re-broadcast)
          this.connections.forEach((conn) => {
                    if (conn.open) conn.send(envelope);
          });
      }
  }

  subscribe(handler: MessageHandler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
  }

  destroy(): void {
        this.handlers.clear();
        this.connections.forEach((c) => c.close());
        this.connections.clear();
        try { this.peer?.destroy(); } catch (_) { /* ignore */ }
  }
}
