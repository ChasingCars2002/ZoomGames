// ---------------------------------------------------------------------------
// Bluff Trivia (Fibbage) – pure game logic
//
// Each round: every player writes a fake answer to a trivia question, then the
// pool of fakes + the real answer is shown shuffled and everyone picks the one
// they think is true. You score for finding the truth and for every player your
// fake fools.
//
// The host is the sole authority for the answer key: the truth and the
// per-option `isTruth` flags never leave the host until the reveal. assembleOptions
// builds the keyed pool host-side; the host then strips the key (maskOptions)
// before syncing to clients during the 'choosing' phase.
// ---------------------------------------------------------------------------

import { Player } from '../../../types';

export const TRUTH_POINTS = 500; // picking the real answer
export const FOOL_POINTS = 200; // per player your fake fools

export type BluffPhase = 'writing' | 'choosing' | 'revealing';

export interface BluffOption {
  id: string; // normalized text key (stable)
  text: string; // display text
  isTruth: boolean;
  authorIds: string[]; // players who wrote this fake (empty for the truth)
}

/** Client-facing option with the answer key stripped. */
export interface MaskedOption {
  id: string;
  text: string;
}

export interface BluffActionEntry {
  playerId: string;
  action: { type: string; text?: string; index?: number };
  timestamp: number;
}

/** Lowercase, strip punctuation, collapse whitespace — for dedup comparison. */
export function normalizeAnswer(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build the keyed option pool from the truth and the submitted fakes.
 * - Fakes that normalize-equal the truth are dropped (their author earns nothing
 *   from them, but may still pick the truth).
 * - Identical fakes from different authors merge into one option carrying all
 *   author ids.
 * Returns options in a stable insertion order (truth last); the caller shuffles.
 */
export function assembleOptions(
  truth: string,
  fakes: { playerId: string; text: string }[],
): BluffOption[] {
  const normTruth = normalizeAnswer(truth);
  const byNorm = new Map<string, BluffOption>();

  for (const { playerId, text } of fakes) {
    const norm = normalizeAnswer(text);
    if (!norm || norm === normTruth) continue; // empty or collides with truth

    const existing = byNorm.get(norm);
    if (existing) {
      if (!existing.authorIds.includes(playerId)) existing.authorIds.push(playerId);
    } else {
      byNorm.set(norm, {
        id: norm,
        text: text.trim(),
        isTruth: false,
        authorIds: [playerId],
      });
    }
  }

  const options = [...byNorm.values()];
  options.push({ id: `truth:${normTruth}`, text: truth, isTruth: true, authorIds: [] });
  return options;
}

/** Strip the answer key for syncing to clients during 'choosing'. */
export function maskOptions(options: BluffOption[]): MaskedOption[] {
  return options.map((o) => ({ id: o.id, text: o.text }));
}

/** Latest valid fake per player (last-write-wins). */
export function deriveFakes(actions: BluffActionEntry[] | undefined): Record<string, string> {
  const fakes: Record<string, string> = {};
  for (const entry of actions ?? []) {
    if (entry.action.type === 'submit_fake' && typeof entry.action.text === 'string') {
      const t = entry.action.text.trim();
      if (t) fakes[entry.playerId] = t;
    }
  }
  return fakes;
}

/**
 * Latest valid pick per player. A pick is valid when the index is in range and
 * the player did not author that option. Returns playerId -> option index.
 */
export function derivePicks(
  actions: BluffActionEntry[] | undefined,
  options: { authorIds?: string[] }[],
): Record<string, number> {
  const picks: Record<string, number> = {};
  for (const entry of actions ?? []) {
    if (entry.action.type !== 'pick_answer') continue;
    const idx = entry.action.index;
    if (typeof idx !== 'number' || idx < 0 || idx >= options.length) continue;
    if (options[idx].authorIds?.includes(entry.playerId)) continue; // can't pick own
    picks[entry.playerId] = idx;
  }
  return picks;
}

/** Whether a player may pick the option at `index` (in range, not their own). */
export function canPick(options: BluffOption[], playerId: string, index: number): boolean {
  if (index < 0 || index >= options.length) return false;
  return !options[index].authorIds.includes(playerId);
}

/**
 * Score a resolved round. Picking the truth = TRUTH_POINTS. Each distinct other
 * player who picked your fake = FOOL_POINTS to you.
 */
export function scoreBluffRound(
  options: BluffOption[],
  picks: Record<string, number>,
  players: Player[],
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = 0;

  for (const [playerId, idx] of Object.entries(picks)) {
    const opt = options[idx];
    if (!opt) continue;
    if (opt.isTruth) {
      scores[playerId] = (scores[playerId] ?? 0) + TRUTH_POINTS;
    } else {
      for (const authorId of opt.authorIds) {
        if (authorId === playerId) continue;
        scores[authorId] = (scores[authorId] ?? 0) + FOOL_POINTS;
      }
    }
  }

  return scores;
}
