import { describe, it, expect } from 'vitest';
import { shuffle, pickRandom, pickRandomN } from './shuffle';

describe('shuffle', () => {
  it('returns a new array (does not mutate original)', () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original);
    expect(result).not.toBe(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });

  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns same length', () => {
    const arr = [10, 20, 30];
    expect(shuffle(arr)).toHaveLength(3);
  });

  it('handles empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

describe('pickRandom', () => {
  it('returns an element from the array', () => {
    const arr = ['a', 'b', 'c'];
    const result = pickRandom(arr);
    expect(arr).toContain(result);
  });

  it('returns the only element for single-element arrays', () => {
    expect(pickRandom([99])).toBe(99);
  });
});

describe('pickRandomN', () => {
  it('returns N elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = pickRandomN(arr, 3);
    expect(result).toHaveLength(3);
  });

  it('returns unique elements from the source array', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = pickRandomN(arr, 3);
    const allFromSource = result.every((item) => arr.includes(item));
    expect(allFromSource).toBe(true);
    // All unique
    expect(new Set(result).size).toBe(3);
  });

  it('returns full array when N >= array length', () => {
    const arr = [1, 2, 3];
    const result = pickRandomN(arr, 5);
    expect(result.sort()).toEqual([1, 2, 3]);
  });

  it('returns empty array for N=0', () => {
    expect(pickRandomN([1, 2, 3], 0)).toEqual([]);
  });
});
