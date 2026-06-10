import { describe, it, expect } from 'vitest';
import {
  HangmanRoundData,
  HangmanActionEntry,
  deriveHangmanState,
  maskWord,
  normalizeLetter,
  normalizeWordGuess,
  hiddenLetterCount,
  isFullyRevealed,
  MAX_WRONG,
  LETTER_POINTS,
  SOLVE_MIN_POINTS,
  SOLVE_POINTS_PER_HIDDEN,
} from './hangmanLogic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function letterAction(playerId: string, letter: string): HangmanActionEntry {
  return { playerId, action: { type: 'guess_letter', letter }, timestamp: Date.now() };
}

function wordAction(playerId: string, guess: string): HangmanActionEntry {
  return { playerId, action: { type: 'guess', guess }, timestamp: Date.now() };
}

function round(word: string, actions: HangmanActionEntry[] = []): HangmanRoundData {
  return { word, category: 'Test', maxWrong: MAX_WRONG, actions };
}

// ---------------------------------------------------------------------------
// normalizeLetter / normalizeWordGuess
// ---------------------------------------------------------------------------

describe('normalizeLetter', () => {
  it('uppercases single letters', () => {
    expect(normalizeLetter('a')).toBe('A');
    expect(normalizeLetter(' z ')).toBe('Z');
  });

  it('rejects non-letters and multi-char strings', () => {
    expect(normalizeLetter('1')).toBeNull();
    expect(normalizeLetter('ab')).toBeNull();
    expect(normalizeLetter('')).toBeNull();
    expect(normalizeLetter(undefined)).toBeNull();
  });
});

describe('normalizeWordGuess', () => {
  it('strips non-letters so punctuation and spacing do not matter', () => {
    expect(normalizeWordGuess('Reply-All!')).toBe('REPLYALL');
    expect(normalizeWordGuess(' reply all ')).toBe('REPLYALL');
  });
});

// ---------------------------------------------------------------------------
// maskWord / hiddenLetterCount
// ---------------------------------------------------------------------------

describe('maskWord', () => {
  it('hides unguessed letters and reveals non-letters', () => {
    expect(maskWord('JET LAG', new Set(['A']))).toEqual([
      null, null, null, ' ', null, 'A', null,
    ]);
  });

  it('reveals guessed letters everywhere they occur', () => {
    expect(maskWord('PIZZA', new Set(['Z']))).toEqual([null, null, 'Z', 'Z', null]);
  });
});

describe('hiddenLetterCount / isFullyRevealed', () => {
  it('counts only hidden letter positions', () => {
    expect(hiddenLetterCount('JET LAG', new Set())).toBe(6);
    expect(hiddenLetterCount('JET LAG', new Set(['J', 'E', 'T']))).toBe(3);
  });

  it('detects a fully revealed word', () => {
    expect(isFullyRevealed('TACO', new Set(['T', 'A', 'C', 'O']))).toBe(true);
    expect(isFullyRevealed('TACO', new Set(['T', 'A']))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveHangmanState
// ---------------------------------------------------------------------------

describe('deriveHangmanState', () => {
  it('starts pending with no guesses', () => {
    const state = deriveHangmanState(round('PIZZA'));
    expect(state.outcome).toBe('pending');
    expect(state.wrongCount).toBe(0);
    expect(state.letterGuesses).toHaveLength(0);
  });

  it('awards points per occurrence for correct letters', () => {
    const state = deriveHangmanState(round('PIZZA', [letterAction('p1', 'z')]));
    expect(state.letterGuesses).toEqual([{ letter: 'Z', playerId: 'p1', correct: true }]);
    expect(state.pointsByPlayer['p1']).toBe(LETTER_POINTS * 2);
    expect(state.revealedLetters).toContain('Z');
  });

  it('counts wrong letters as strikes without points', () => {
    const state = deriveHangmanState(round('PIZZA', [letterAction('p1', 'X')]));
    expect(state.wrongCount).toBe(1);
    expect(state.pointsByPlayer['p1']).toBeUndefined();
  });

  it('ignores duplicate letter guesses entirely', () => {
    const state = deriveHangmanState(
      round('PIZZA', [letterAction('p1', 'X'), letterAction('p2', 'x'), letterAction('p2', 'Z'), letterAction('p1', 'z')]),
    );
    expect(state.wrongCount).toBe(1);
    expect(state.letterGuesses).toHaveLength(2);
    expect(state.pointsByPlayer['p2']).toBe(LETTER_POINTS * 2);
    expect(state.pointsByPlayer['p1']).toBeUndefined();
  });

  it('ignores invalid letters', () => {
    const state = deriveHangmanState(round('PIZZA', [letterAction('p1', '3'), letterAction('p1', 'zz')]));
    expect(state.letterGuesses).toHaveLength(0);
    expect(state.wrongCount).toBe(0);
  });

  it('wins when the last letter is revealed', () => {
    const state = deriveHangmanState(
      round('TACO', [
        letterAction('p1', 'T'),
        letterAction('p2', 'A'),
        letterAction('p1', 'C'),
        letterAction('p2', 'O'),
      ]),
    );
    expect(state.outcome).toBe('won');
    expect(state.solverId).toBe('p2');
  });

  it('loses after maxWrong strikes', () => {
    const wrong = ['B', 'D', 'E', 'F', 'G', 'H'].map((l) => letterAction('p1', l));
    const state = deriveHangmanState(round('PIZZA', wrong));
    expect(state.wrongCount).toBe(MAX_WRONG);
    expect(state.outcome).toBe('lost');
  });

  it('stops processing actions after the round resolves', () => {
    const wrong = ['B', 'D', 'E', 'F', 'G', 'H'].map((l) => letterAction('p1', l));
    const state = deriveHangmanState(round('PIZZA', [...wrong, letterAction('p2', 'Z')]));
    expect(state.outcome).toBe('lost');
    expect(state.pointsByPlayer['p2']).toBeUndefined();
  });

  it('full-word solve wins, reveals everything, and scales points by hidden letters', () => {
    const state = deriveHangmanState(round('JET LAG', [wordAction('p1', 'jet-lag')]));
    expect(state.outcome).toBe('won');
    expect(state.solverId).toBe('p1');
    // 6 hidden letters * 20 = 120
    expect(state.pointsByPlayer['p1']).toBe(SOLVE_POINTS_PER_HIDDEN * 6);
    expect(isFullyRevealed('JET LAG', new Set(state.revealedLetters))).toBe(true);
  });

  it('full-word solve has a minimum reward when few letters remain', () => {
    const state = deriveHangmanState(
      round('TACO', [
        letterAction('p1', 'T'),
        letterAction('p1', 'A'),
        letterAction('p1', 'C'),
        wordAction('p2', 'taco'),
      ]),
    );
    expect(state.outcome).toBe('won');
    expect(state.pointsByPlayer['p2']).toBe(SOLVE_MIN_POINTS);
  });

  it('failed solve attempts cost a strike', () => {
    const state = deriveHangmanState(round('PIZZA', [wordAction('p1', 'PASTA')]));
    expect(state.wrongCount).toBe(1);
    expect(state.wordAttempts).toEqual([{ playerId: 'p1', guess: 'PASTA', correct: false }]);
    expect(state.outcome).toBe('pending');
  });

  it('is deterministic: same log produces identical state', () => {
    const actions = [
      letterAction('p1', 'P'),
      letterAction('p2', 'X'),
      letterAction('p1', 'I'),
      wordAction('p2', 'pizza'),
    ];
    const a = deriveHangmanState(round('PIZZA', actions));
    const b = deriveHangmanState(round('PIZZA', actions));
    expect(a).toEqual(b);
  });
});
