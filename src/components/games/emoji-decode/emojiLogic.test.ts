import { describe, it, expect } from 'vitest';
import {
  normalizeGuess,
  matchEmojiGuess,
  deriveEmojiState,
  EmojiActionEntry,
} from './emojiLogic';

function guess(playerId: string, text: string, ts = 0): EmojiActionEntry {
  return { playerId, action: { type: 'guess', guess: text }, timestamp: ts };
}

describe('normalizeGuess', () => {
  it('lowercases and strips punctuation (hyphens removed, not spaced)', () => {
    expect(normalizeGuess('The Lion-King!')).toBe('the lionking');
  });
  it('keeps letters, digits, single spaces', () => {
    expect(normalizeGuess('  9 to 5!! ')).toBe('9 to 5');
    expect(normalizeGuess(undefined)).toBe('');
  });
});

describe('matchEmojiGuess', () => {
  it('matches exact answer ignoring case/spacing/punctuation', () => {
    expect(matchEmojiGuess('the lion king', 'The Lion King')).toBe(true);
    expect(matchEmojiGuess('LIONKING', 'The Lion King', ['Lion King'])).toBe(true);
    expect(matchEmojiGuess('spider man', 'Spider-Man', ['Spiderman'])).toBe(true);
  });
  it('matches aliases', () => {
    expect(matchEmojiGuess('lotr', 'Lord of the Rings', ['LOTR'])).toBe(true);
  });
  it('rejects wrong guesses and empties', () => {
    expect(matchEmojiGuess('star wars', 'The Lion King')).toBe(false);
    expect(matchEmojiGuess('', 'The Lion King')).toBe(false);
    expect(matchEmojiGuess('!!!', 'The Lion King')).toBe(false);
  });
});

describe('deriveEmojiState', () => {
  const rd = { answer: 'Pizza Time', aliases: [] as string[] };

  it('is pending with no correct guesses', () => {
    const s = deriveEmojiState({ ...rd, actions: [guess('p1', 'tacos'), guess('p2', 'lunch')] });
    expect(s.outcome).toBe('pending');
    expect(s.winnerId).toBeNull();
    expect(s.guesses).toHaveLength(2);
    expect(s.guesses.every((g) => !g.correct)).toBe(true);
  });

  it('first correct guess wins; later guesses are not credited', () => {
    const s = deriveEmojiState({
      ...rd,
      actions: [guess('p1', 'nope', 1), guess('p2', 'Pizza Time', 2), guess('p3', 'pizza time', 3)],
    });
    expect(s.outcome).toBe('won');
    expect(s.winnerId).toBe('p2');
    const correctGuesses = s.guesses.filter((g) => g.correct);
    expect(correctGuesses).toHaveLength(1);
    expect(correctGuesses[0].playerId).toBe('p2');
  });

  it('ignores empty/whitespace guesses', () => {
    const s = deriveEmojiState({ ...rd, actions: [guess('p1', '   '), guess('p1', '')] });
    expect(s.guesses).toHaveLength(0);
  });

  it('is deterministic for the same log', () => {
    const actions = [guess('p1', 'x', 1), guess('p2', 'pizza time', 2)];
    expect(deriveEmojiState({ ...rd, actions })).toEqual(deriveEmojiState({ ...rd, actions }));
  });
});
