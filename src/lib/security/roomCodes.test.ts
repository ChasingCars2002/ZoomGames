import { describe, it, expect } from 'vitest';
import { generateRoomCode, isValidRoomCode, releaseRoomCode } from './roomCodes';

describe('generateRoomCode', () => {
  it('returns a 6-character string', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('only contains uppercase letters and digits (excluding ambiguous chars)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      releaseRoomCode(code);
    }
  });

  it('generates unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateRoomCode());
    }
    expect(codes.size).toBe(20);

    // Clean up
    codes.forEach((c) => releaseRoomCode(c));
  });
});

describe('isValidRoomCode', () => {
  it('accepts a valid 6-char alphanumeric code', () => {
    expect(isValidRoomCode('ABC123')).toBe(true);
    expect(isValidRoomCode('ZZZZZZ')).toBe(true);
    expect(isValidRoomCode('000000')).toBe(true);
  });

  it('rejects codes that are too short', () => {
    expect(isValidRoomCode('AB12')).toBe(false);
  });

  it('rejects codes that are too long', () => {
    expect(isValidRoomCode('ABCDEFG')).toBe(false);
  });

  it('rejects codes with lowercase letters', () => {
    expect(isValidRoomCode('abcdef')).toBe(false);
  });

  it('rejects codes with special characters', () => {
    expect(isValidRoomCode('ABC-12')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidRoomCode('')).toBe(false);
  });
});

describe('releaseRoomCode', () => {
  it('allows re-generation of a released code (no error)', () => {
    const code = generateRoomCode();
    releaseRoomCode(code);
    // Should not throw
    expect(() => releaseRoomCode(code)).not.toThrow();
  });
});
