import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, resetRateLimit } from './rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset state between tests
    resetRateLimit('room_create');
    resetRateLimit('chat_message');
    resetRateLimit('guess_attempt');
    resetRateLimit('player_action');
  });

  it('allows actions within the rate limit', () => {
    const result = checkRateLimit('room_create');
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it('allows unknown actions', () => {
    const result = checkRateLimit('nonexistent_action');
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it('blocks after exceeding max attempts', () => {
    // guess_attempt: 3 attempts per 2000ms
    checkRateLimit('guess_attempt');
    checkRateLimit('guess_attempt');
    checkRateLimit('guess_attempt');
    const result = checkRateLimit('guess_attempt');

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('allows again after the window expires', () => {
    vi.useFakeTimers();

    // Exhaust the limit
    checkRateLimit('guess_attempt');
    checkRateLimit('guess_attempt');
    checkRateLimit('guess_attempt');

    expect(checkRateLimit('guess_attempt').allowed).toBe(false);

    // Advance past the window (2000ms)
    vi.advanceTimersByTime(2100);

    expect(checkRateLimit('guess_attempt').allowed).toBe(true);

    vi.useRealTimers();
  });

  it('resets rate limit with resetRateLimit', () => {
    checkRateLimit('guess_attempt');
    checkRateLimit('guess_attempt');
    checkRateLimit('guess_attempt');

    expect(checkRateLimit('guess_attempt').allowed).toBe(false);

    resetRateLimit('guess_attempt');

    expect(checkRateLimit('guess_attempt').allowed).toBe(true);
  });
});
