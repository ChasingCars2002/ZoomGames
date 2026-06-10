import { describe, it, expect } from 'vitest';
import { Player, Role } from '../../../types';
import {
  clampPosition,
  scoreBandPoints,
  deriveClue,
  derivePositions,
  scoreMeldRound,
  MeldActionEntry,
} from './meldLogic';

function player(id: string): Player {
  return { id, name: id, role: Role.PLAYER, ready: false, connected: true, joinedAt: 0, color: '#fff', isBot: false };
}
function clue(playerId: string, text: string, ts = 0): MeldActionEntry {
  return { playerId, action: { type: 'submit_clue', text }, timestamp: ts };
}
function pos(playerId: string, value: number, ts = 0): MeldActionEntry {
  return { playerId, action: { type: 'submit_position', value }, timestamp: ts };
}

describe('clampPosition', () => {
  it('clamps and rounds into 0..100', () => {
    expect(clampPosition(-5)).toBe(0);
    expect(clampPosition(150)).toBe(100);
    expect(clampPosition(42.6)).toBe(43);
    expect(clampPosition('x')).toBe(0);
  });
});

describe('scoreBandPoints', () => {
  it('bands by distance', () => {
    expect(scoreBandPoints(0)).toBe(200);
    expect(scoreBandPoints(4)).toBe(200);
    expect(scoreBandPoints(-4)).toBe(200);
    expect(scoreBandPoints(7)).toBe(100);
    expect(scoreBandPoints(10)).toBe(100);
    expect(scoreBandPoints(15)).toBe(50);
    expect(scoreBandPoints(20)).toBe(50);
    expect(scoreBandPoints(21)).toBe(0);
    expect(scoreBandPoints(80)).toBe(0);
  });
});

describe('deriveClue', () => {
  it('takes the latest clue from the giver only', () => {
    const actions = [clue('giver', 'first', 1), clue('p2', 'ignored', 2), clue('giver', 'final', 3)];
    expect(deriveClue(actions, 'giver')).toBe('final');
  });
  it('empty when none', () => {
    expect(deriveClue([], 'giver')).toBe('');
  });
});

describe('derivePositions', () => {
  it('takes latest position per non-giver, clamped', () => {
    const actions = [pos('p2', 30, 1), pos('p2', 60, 2), pos('p3', 120, 3), pos('giver', 50, 4)];
    expect(derivePositions(actions, 'giver')).toEqual({ p2: 60, p3: 100 });
  });
});

describe('scoreMeldRound', () => {
  const players = [player('giver'), player('p2'), player('p3')];

  it('scores guessers by band and gives the giver the mean', () => {
    const positions = { p2: 50, p3: 60 }; // target 52: p2 dist 2 ->200, p3 dist 8 ->100
    const scores = scoreMeldRound(52, positions, 'giver', players);
    expect(scores.p2).toBe(200);
    expect(scores.p3).toBe(100);
    expect(scores.giver).toBe(150); // mean of 200 and 100
  });

  it('giver earns 0 when nobody guessed', () => {
    const scores = scoreMeldRound(52, {}, 'giver', players);
    expect(scores).toEqual({ giver: 0, p2: 0, p3: 0 });
  });

  it('ignores a stray giver position and rounds the mean', () => {
    const positions = { giver: 52, p2: 40, p3: 100 }; // target 52: p2 dist12->50, p3 dist48->0
    const scores = scoreMeldRound(52, positions, 'giver', players);
    expect(scores.p2).toBe(50);
    expect(scores.p3).toBe(0);
    expect(scores.giver).toBe(25); // round(mean(50,0))
  });
});
