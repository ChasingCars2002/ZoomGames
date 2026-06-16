import { describe, it, expect } from 'vitest';
import { Player, Role } from '../../../types';
import {
  normalizeAnswer,
  isValidAnswer,
  deriveSubmissions,
  tallyScattergories,
  POINTS_PER_UNIQUE,
} from './scattergoriesLogic';

function player(id: string): Player {
  return {
    id,
    name: id,
    role: Role.PLAYER,
    ready: false,
    connected: true,
    joinedAt: 0,
    color: '#fff',
    isBot: false,
  };
}

describe('normalizeAnswer', () => {
  it('trims, collapses whitespace, lowercases', () => {
    expect(normalizeAnswer('  Red   Apple ')).toBe('red apple');
    expect(normalizeAnswer('CAT')).toBe('cat');
  });
  it('handles non-strings', () => {
    expect(normalizeAnswer(undefined)).toBe('');
    expect(normalizeAnswer(42)).toBe('');
  });
});

describe('isValidAnswer', () => {
  it('accepts answers starting with the letter (case-insensitive)', () => {
    expect(isValidAnswer('Apple', 'A')).toBe(true);
    expect(isValidAnswer('apple', 'a')).toBe(true);
    expect(isValidAnswer('  apricot', 'A')).toBe(true);
  });
  it('skips leading punctuation', () => {
    expect(isValidAnswer('"Avocado"', 'A')).toBe(true);
  });
  it('rejects wrong letter and empty', () => {
    expect(isValidAnswer('Banana', 'A')).toBe(false);
    expect(isValidAnswer('', 'A')).toBe(false);
    expect(isValidAnswer('   ', 'A')).toBe(false);
  });
});

describe('deriveSubmissions', () => {
  it('keeps the latest submission per player (last-write-wins)', () => {
    const actions = [
      { playerId: 'p1', action: { type: 'submit_answers', answers: ['a', 'b'] }, timestamp: 1 },
      { playerId: 'p2', action: { type: 'submit_answers', answers: ['c'] }, timestamp: 2 },
      { playerId: 'p1', action: { type: 'submit_answers', answers: ['x', 'y'] }, timestamp: 3 },
    ];
    expect(deriveSubmissions(actions)).toEqual({ p1: ['x', 'y'], p2: ['c'] });
  });
  it('ignores unrelated actions and undefined', () => {
    expect(deriveSubmissions(undefined)).toEqual({});
    expect(
      deriveSubmissions([{ playerId: 'p1', action: { type: 'guess' }, timestamp: 1 }]),
    ).toEqual({});
  });
});

describe('tallyScattergories', () => {
  const cats = ['Fruit', 'Animal'];

  it('scores valid + unique answers, zeroes duplicates', () => {
    const players = [player('p1'), player('p2'), player('p3')];
    const submissions = {
      p1: ['Apple', 'Antelope'],
      p2: ['Apple', 'Alligator'], // Apple duplicates p1 -> both 0
      p3: ['Apricot', 'Anteater'],
    };
    const tally = tallyScattergories(submissions, 'A', cats, players);
    // Fruit: Apple x2 (dup -> 0), Apricot unique (+100)
    // Animal: all three unique (+100 each)
    expect(tally.scores).toEqual({
      p1: POINTS_PER_UNIQUE, // antelope
      p2: POINTS_PER_UNIQUE, // alligator
      p3: POINTS_PER_UNIQUE * 2, // apricot + anteater
    });
  });

  it('treats case/whitespace variants as duplicates', () => {
    const players = [player('p1'), player('p2')];
    const submissions = { p1: ['Apple'], p2: ['  apple '] };
    const tally = tallyScattergories(submissions, 'A', ['Fruit'], players);
    expect(tally.scores).toEqual({ p1: 0, p2: 0 });
    expect(tally.perCategory[0].entries.every((e) => !e.unique)).toBe(true);
  });

  it('rejects wrong-letter answers as invalid (no score, not a duplicate)', () => {
    const players = [player('p1'), player('p2')];
    const submissions = { p1: ['Banana'], p2: ['Apple'] };
    const tally = tallyScattergories(submissions, 'A', ['Fruit'], players);
    expect(tally.scores).toEqual({ p1: 0, p2: POINTS_PER_UNIQUE });
    const e1 = tally.perCategory[0].entries.find((e) => e.playerId === 'p1')!;
    expect(e1.valid).toBe(false);
  });

  it('single player: every valid answer is unique', () => {
    const players = [player('solo')];
    const submissions = { solo: ['Apple', 'Ant'] };
    const tally = tallyScattergories(submissions, 'A', cats, players);
    expect(tally.scores).toEqual({ solo: POINTS_PER_UNIQUE * 2 });
  });

  it('handles missing submissions and empty cells', () => {
    const players = [player('p1'), player('p2')];
    const submissions = { p1: ['Apple'] }; // p2 never submitted
    const tally = tallyScattergories(submissions, 'A', ['Fruit'], players);
    expect(tally.scores).toEqual({ p1: POINTS_PER_UNIQUE, p2: 0 });
  });

  it('all-duplicate category scores everyone 0 without crashing', () => {
    const players = [player('p1'), player('p2'), player('p3')];
    const submissions = { p1: ['Ant'], p2: ['ant'], p3: ['ANT'] };
    const tally = tallyScattergories(submissions, 'A', ['Animal'], players);
    expect(tally.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });
});
