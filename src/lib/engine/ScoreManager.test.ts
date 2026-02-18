import { describe, it, expect } from 'vitest';
import {
  calculateSpeedBonus,
  calculateGuessPoints,
  calculateTriviaPoints,
  calculateScramblePoints,
  mergeScores,
} from './ScoreManager';

// ---------------------------------------------------------------------------
// calculateSpeedBonus
// ---------------------------------------------------------------------------

describe('calculateSpeedBonus', () => {
  it('returns 2.0 when full time remains', () => {
    expect(calculateSpeedBonus(60, 60)).toBe(2.0);
  });

  it('returns 1.0 when no time remains', () => {
    expect(calculateSpeedBonus(0, 60)).toBe(1.0);
  });

  it('returns 1.5 when half time remains', () => {
    expect(calculateSpeedBonus(30, 60)).toBe(1.5);
  });

  it('returns 1.0 when totalTime is 0', () => {
    expect(calculateSpeedBonus(10, 0)).toBe(1.0);
  });

  it('clamps timeRemaining to range [0, totalTime]', () => {
    expect(calculateSpeedBonus(-5, 60)).toBe(1.0);
    expect(calculateSpeedBonus(100, 60)).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// calculateGuessPoints (Pictionary / Charades)
// ---------------------------------------------------------------------------

describe('calculateGuessPoints', () => {
  it('gives 1000 points to first guesser with full time (500 base * 2.0 speed)', () => {
    expect(calculateGuessPoints(60, 60, 1)).toBe(1000);
  });

  it('gives 500 points to first guesser with no time left (500 base * 1.0 speed)', () => {
    expect(calculateGuessPoints(0, 60, 1)).toBe(500);
  });

  it('reduces points by 10% for each subsequent guesser', () => {
    const first = calculateGuessPoints(30, 60, 1);
    const second = calculateGuessPoints(30, 60, 2);
    const third = calculateGuessPoints(30, 60, 3);

    expect(second).toBeLessThan(first);
    expect(third).toBeLessThan(second);

    // second guesser gets 90% of first guesser base
    expect(second).toBe(Math.round(500 * 1.5 * 0.9));
    expect(third).toBe(Math.round(500 * 1.5 * 0.8));
  });

  it('never returns negative points (order > 10)', () => {
    expect(calculateGuessPoints(60, 60, 15)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTriviaPoints
// ---------------------------------------------------------------------------

describe('calculateTriviaPoints', () => {
  it('returns 0 for incorrect answer', () => {
    expect(calculateTriviaPoints(60, 60, false)).toBe(0);
  });

  it('returns 2000 for correct answer with full time (1000 * 2.0)', () => {
    expect(calculateTriviaPoints(60, 60, true)).toBe(2000);
  });

  it('returns 1000 for correct answer with no time', () => {
    expect(calculateTriviaPoints(0, 60, true)).toBe(1000);
  });

  it('returns 1500 for correct answer at half time', () => {
    expect(calculateTriviaPoints(30, 60, true)).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// calculateScramblePoints
// ---------------------------------------------------------------------------

describe('calculateScramblePoints', () => {
  it('gives 1500 points to first solver with full time (750 * 2.0)', () => {
    expect(calculateScramblePoints(60, 60, 1)).toBe(1500);
  });

  it('gives 750 points to first solver with no time', () => {
    expect(calculateScramblePoints(0, 60, 1)).toBe(750);
  });

  it('reduces by 15% per subsequent solver', () => {
    const first = calculateScramblePoints(30, 60, 1);
    const second = calculateScramblePoints(30, 60, 2);

    // second solver: 750 * 1.5 * 0.85
    expect(first).toBe(Math.round(750 * 1.5 * 1.0));
    expect(second).toBe(Math.round(750 * 1.5 * 0.85));
  });

  it('floors at 0 for very late solvers', () => {
    expect(calculateScramblePoints(60, 60, 20)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mergeScores
// ---------------------------------------------------------------------------

describe('mergeScores', () => {
  it('merges round scores into existing scores', () => {
    const existing = { a: 100, b: 200 };
    const round = { a: 50, b: 75 };
    expect(mergeScores(existing, round)).toEqual({ a: 150, b: 275 });
  });

  it('adds new players not in existing scores', () => {
    const existing = { a: 100 };
    const round = { b: 50 };
    expect(mergeScores(existing, round)).toEqual({ a: 100, b: 50 });
  });

  it('does not mutate input objects', () => {
    const existing = { a: 100 };
    const round = { a: 50 };
    const result = mergeScores(existing, round);

    expect(existing.a).toBe(100);
    expect(result.a).toBe(150);
    expect(result).not.toBe(existing);
  });

  it('handles empty round scores', () => {
    const existing = { a: 100 };
    expect(mergeScores(existing, {})).toEqual({ a: 100 });
  });

  it('handles empty existing scores', () => {
    expect(mergeScores({}, { a: 100 })).toEqual({ a: 100 });
  });
});
