// ---------------------------------------------------------------------------
// Mind Meld (Wavelength) – pure game logic
//
// One player (the clue-giver) sees a hidden target on a 0–100 spectrum and
// writes a one-line clue. Everyone else slides to where they think the target
// is. Closer guesses score more; the clue-giver earns the team's average,
// rewarding a clue that lands the whole group well.
//
// The target is the round's secret — it lives in a host-only ref and is masked
// (-1) in the synced roundData until the reveal.
// ---------------------------------------------------------------------------

import { Player } from '../../../types';

export interface MeldActionEntry {
  playerId: string;
  action: { type: string; text?: string; value?: number };
  timestamp: number;
}

/** Clamp to an integer in [0, 100]. */
export function clampPosition(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Banded proximity points: bullseye / close / near / miss. */
export function scoreBandPoints(distance: number): number {
  const d = Math.abs(distance);
  if (d <= 4) return 200;
  if (d <= 10) return 100;
  if (d <= 20) return 50;
  return 0;
}

/** Latest clue text submitted by the clue-giver. */
export function deriveClue(
  actions: MeldActionEntry[] | undefined,
  clueGiverId: string,
): string {
  let clue = '';
  for (const entry of actions ?? []) {
    if (entry.action.type === 'submit_clue' && entry.playerId === clueGiverId) {
      clue = typeof entry.action.text === 'string' ? entry.action.text : clue;
    }
  }
  return clue;
}

/** Latest slider position per non-giver (clamped to 0–100). */
export function derivePositions(
  actions: MeldActionEntry[] | undefined,
  clueGiverId: string,
): Record<string, number> {
  const positions: Record<string, number> = {};
  for (const entry of actions ?? []) {
    if (
      entry.action.type === 'submit_position' &&
      entry.playerId !== clueGiverId &&
      entry.action.value !== undefined
    ) {
      positions[entry.playerId] = clampPosition(entry.action.value);
    }
  }
  return positions;
}

/**
 * Score a resolved round. Each guesser earns the band points for their distance
 * to the target. The clue-giver earns the (rounded) mean of all guessers'
 * points — a cooperative bonus that is 0 when nobody guessed.
 */
export function scoreMeldRound(
  target: number,
  positions: Record<string, number>,
  clueGiverId: string,
  players: Player[],
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = 0;

  const guesserPoints: number[] = [];
  for (const [playerId, pos] of Object.entries(positions)) {
    if (playerId === clueGiverId) continue;
    const pts = scoreBandPoints(pos - target);
    scores[playerId] = pts;
    guesserPoints.push(pts);
  }

  if (guesserPoints.length > 0) {
    const mean = guesserPoints.reduce((a, b) => a + b, 0) / guesserPoints.length;
    scores[clueGiverId] = Math.round(mean);
  }

  return scores;
}
