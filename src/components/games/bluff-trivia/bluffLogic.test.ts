import { describe, it, expect } from 'vitest';
import { Player, Role } from '../../../types';
import {
  normalizeAnswer,
  assembleOptions,
  maskOptions,
  deriveFakes,
  derivePicks,
  canPick,
  scoreBluffRound,
  TRUTH_POINTS,
  FOOL_POINTS,
  BluffActionEntry,
} from './bluffLogic';

function player(id: string): Player {
  return { id, name: id, role: Role.PLAYER, ready: false, connected: true, joinedAt: 0, color: '#fff', isBot: false };
}
function fakeAction(playerId: string, text: string, ts = 0): BluffActionEntry {
  return { playerId, action: { type: 'submit_fake', text }, timestamp: ts };
}
function pickAction(playerId: string, index: number, ts = 0): BluffActionEntry {
  return { playerId, action: { type: 'pick_answer', index }, timestamp: ts };
}

describe('normalizeAnswer', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeAnswer('  Vatican City! ')).toBe('vatican city');
    expect(normalizeAnswer('Three.')).toBe('three');
  });
});

describe('assembleOptions', () => {
  it('includes the truth plus each distinct fake', () => {
    const opts = assembleOptions('Canada', [
      { playerId: 'p1', text: 'Russia' },
      { playerId: 'p2', text: 'Brazil' },
    ]);
    expect(opts).toHaveLength(3);
    expect(opts.filter((o) => o.isTruth)).toHaveLength(1);
    expect(opts.find((o) => o.isTruth)!.text).toBe('Canada');
  });

  it('drops fakes that equal the truth (case/punctuation-insensitive)', () => {
    const opts = assembleOptions('Canada', [
      { playerId: 'p1', text: 'canada' },
      { playerId: 'p2', text: 'Brazil' },
    ]);
    // p1's fake collides with the truth -> dropped; truth + Brazil = 2
    expect(opts).toHaveLength(2);
    expect(opts.some((o) => !o.isTruth && o.authorIds.includes('p1'))).toBe(false);
  });

  it('merges identical fakes from different authors into one option', () => {
    const opts = assembleOptions('Canada', [
      { playerId: 'p1', text: 'Russia' },
      { playerId: 'p2', text: 'russia' },
      { playerId: 'p3', text: 'Brazil' },
    ]);
    const russia = opts.find((o) => o.id === 'russia')!;
    expect(russia.authorIds.sort()).toEqual(['p1', 'p2']);
    // truth + russia + brazil
    expect(opts).toHaveLength(3);
  });

  it('skips empty fakes', () => {
    const opts = assembleOptions('Canada', [{ playerId: 'p1', text: '   ' }]);
    expect(opts).toHaveLength(1);
    expect(opts[0].isTruth).toBe(true);
  });
});

describe('maskOptions', () => {
  it('strips isTruth and authorIds', () => {
    const opts = assembleOptions('Canada', [{ playerId: 'p1', text: 'Russia' }]);
    const masked = maskOptions(opts);
    expect(masked.every((m) => !('isTruth' in m) && !('authorIds' in m))).toBe(true);
    expect(masked).toHaveLength(opts.length);
  });
});

describe('deriveFakes', () => {
  it('keeps the latest fake per player', () => {
    const fakes = deriveFakes([
      fakeAction('p1', 'Russia', 1),
      fakeAction('p1', 'Mexico', 2),
      fakeAction('p2', 'Brazil', 3),
    ]);
    expect(fakes).toEqual({ p1: 'Mexico', p2: 'Brazil' });
  });
  it('ignores empty', () => {
    expect(deriveFakes([fakeAction('p1', '  ')])).toEqual({});
  });
});

describe('derivePicks / canPick', () => {
  const opts = assembleOptions('Canada', [
    { playerId: 'p1', text: 'Russia' },
    { playerId: 'p2', text: 'Brazil' },
  ]);
  const russiaIdx = opts.findIndex((o) => o.id === 'russia');

  it('rejects picking your own fake', () => {
    expect(canPick(opts, 'p1', russiaIdx)).toBe(false);
    expect(canPick(opts, 'p2', russiaIdx)).toBe(true);
  });

  it('drops invalid (own / out-of-range) picks and keeps the latest valid one', () => {
    const picks = derivePicks(
      [pickAction('p1', russiaIdx, 1), pickAction('p2', 99, 2), pickAction('p2', russiaIdx, 3)],
      opts,
    );
    expect(picks).toEqual({ p2: russiaIdx }); // p1 rejected (own), p2 out-of-range ignored then valid
  });
});

describe('scoreBluffRound', () => {
  const players = [player('p1'), player('p2'), player('p3')];
  const opts = assembleOptions('Canada', [
    { playerId: 'p1', text: 'Russia' },
    { playerId: 'p2', text: 'Brazil' },
  ]);
  const truthIdx = opts.findIndex((o) => o.isTruth);
  const russiaIdx = opts.findIndex((o) => o.id === 'russia');

  it('awards truth-pickers and fools', () => {
    // p2 finds the truth; p3 falls for p1's fake "Russia"
    const picks = { p2: truthIdx, p3: russiaIdx };
    const scores = scoreBluffRound(opts, picks, players);
    expect(scores.p2).toBe(TRUTH_POINTS);
    expect(scores.p1).toBe(FOOL_POINTS); // fooled p3
    expect(scores.p3).toBe(0);
  });

  it('credits every author of a merged fake', () => {
    const merged = assembleOptions('Canada', [
      { playerId: 'p1', text: 'Russia' },
      { playerId: 'p2', text: 'Russia' },
    ]);
    const rIdx = merged.findIndex((o) => o.id === 'russia');
    const scores = scoreBluffRound(merged, { p3: rIdx }, players);
    expect(scores.p1).toBe(FOOL_POINTS);
    expect(scores.p2).toBe(FOOL_POINTS);
  });

  it('gives zero when nobody picks anything', () => {
    const scores = scoreBluffRound(opts, {}, players);
    expect(scores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });
});
