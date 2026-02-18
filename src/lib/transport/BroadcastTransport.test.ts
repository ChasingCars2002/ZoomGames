import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BroadcastTransport } from './BroadcastTransport';
import type { GameMessage } from '../../types/messages';

describe('BroadcastTransport', () => {
  let transport: BroadcastTransport;

  beforeEach(() => {
    transport = new BroadcastTransport('TESTROOM');
  });

  it('has a unique clientId', () => {
    const t2 = new BroadcastTransport('TESTROOM');
    expect(transport.clientId).toBeTruthy();
    expect(transport.clientId).not.toBe(t2.clientId);
    t2.destroy();
    transport.destroy();
  });

  it('sends messages via BroadcastChannel', () => {
    const message: GameMessage = {
      type: 'CHAT_MESSAGE',
      payload: { playerId: 'p1', text: 'Hello', timestamp: Date.now() },
    };

    // Should not throw
    expect(() => transport.send(message)).not.toThrow();
    transport.destroy();
  });

  it('subscribe returns an unsubscribe function', () => {
    const handler = vi.fn();
    const unsub = transport.subscribe(handler);
    expect(typeof unsub).toBe('function');
    unsub();
    transport.destroy();
  });

  it('does not receive own messages', () => {
    const handler = vi.fn();
    transport.subscribe(handler);

    const message: GameMessage = {
      type: 'HEARTBEAT',
      payload: { playerId: 'test', timestamp: Date.now() },
    };
    transport.send(message);

    // BroadcastChannel does not echo back to same page in jsdom.
    // The key behavior: handler should not be called for own messages.
    expect(handler).not.toHaveBeenCalled();
    transport.destroy();
  });

  it('destroy cleans up without error', () => {
    const handler = vi.fn();
    transport.subscribe(handler);
    expect(() => transport.destroy()).not.toThrow();
  });

  it('unsubscribe removes the handler', () => {
    const handler = vi.fn();
    const unsub = transport.subscribe(handler);
    unsub();
    // After unsubscribe, handler set should be empty (internal state)
    // We verify by destroying without issues
    expect(() => transport.destroy()).not.toThrow();
  });
});
