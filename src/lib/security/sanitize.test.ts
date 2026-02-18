import { describe, it, expect } from 'vitest';
import {
  sanitizeNickname,
  sanitizeMessage,
  sanitizeStatement,
  sanitizeRoomCode,
} from './sanitize';

describe('sanitizeNickname', () => {
  it('strips HTML tags', () => {
    expect(sanitizeNickname('<b>Bold</b>')).toBe('Bold');
  });

  it('strips script tags', () => {
    expect(sanitizeNickname('<script>alert(1)</script>')).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeNickname('  Alice  ')).toBe('Alice');
  });

  it('truncates to 20 characters', () => {
    const longName = 'A'.repeat(30);
    expect(sanitizeNickname(longName)).toHaveLength(20);
  });

  it('allows normal text through', () => {
    expect(sanitizeNickname('PlayerOne')).toBe('PlayerOne');
  });
});

describe('sanitizeMessage', () => {
  it('strips HTML', () => {
    expect(sanitizeMessage('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('truncates to 200 characters', () => {
    const long = 'X'.repeat(250);
    expect(sanitizeMessage(long)).toHaveLength(200);
  });

  it('preserves normal chat messages', () => {
    expect(sanitizeMessage('Hello everyone!')).toBe('Hello everyone!');
  });
});

describe('sanitizeStatement', () => {
  it('truncates to 300 characters', () => {
    const long = 'Y'.repeat(400);
    expect(sanitizeStatement(long)).toHaveLength(300);
  });

  it('strips dangerous content', () => {
    expect(sanitizeStatement('<div onmouseover="hack()">hover me</div>')).toBe('hover me');
  });
});

describe('sanitizeRoomCode', () => {
  it('keeps valid uppercase alphanumeric characters', () => {
    expect(sanitizeRoomCode('ABC123')).toBe('ABC123');
  });

  it('strips lowercase letters (regex requires A-Z, 0-9)', () => {
    expect(sanitizeRoomCode('abc123')).toBe('123');
  });

  it('strips non-alphanumeric characters', () => {
    expect(sanitizeRoomCode('AB-C1!23')).toBe('ABC123');
  });

  it('truncates to 6 characters', () => {
    expect(sanitizeRoomCode('ABCDEFGH')).toBe('ABCDEF');
  });

  it('handles empty string', () => {
    expect(sanitizeRoomCode('')).toBe('');
  });
});
