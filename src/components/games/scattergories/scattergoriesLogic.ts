// ---------------------------------------------------------------------------
// Scattergories – pure game logic
//
// A round gives every player one letter and a shared list of categories. Each
// player submits one answer per category. On reveal, an answer scores only if
// it is valid (non-empty and starts with the round letter) AND unique — no
// other player gave the same answer in that category. Duplicates score 0.
//
// All scoring is a pure function of the submissions map, so the host and every
// client compute identical results from the synced roundData.
// ---------------------------------------------------------------------------

import { Player } from '../../../types';

export const POINTS_PER_UNIQUE = 100;

// Letters weighted toward ones that make for an easy, fun round. The hardest
// letters (Q, U, V, X, Y, Z) are intentionally excluded from the pool.
export const LETTER_POOL = 'AAABBCCDDEEFFGGHHIIJKLLMMNNOOPPRRSSTTW'.split('');

export interface ScatterEntry {
  playerId: string;
  answer: string; // raw answer as submitted (may be '')
  valid: boolean;
  unique: boolean;
}

export interface ScatterCategoryResult {
  category: string;
  entries: ScatterEntry[];
}

export interface ScatterTally {
  scores: Record<string, number>;
  perCategory: ScatterCategoryResult[];
}

export interface ScatterActionEntry {
  playerId: string;
  action: { type: string; answers?: string[] };
  timestamp: number;
}

/**
 * Fold the action log into each player's latest submission (last-write-wins).
 * Both host and clients derive the same submission map from the synced log.
 */
export function deriveSubmissions(
  actions: ScatterActionEntry[] | undefined,
): Record<string, string[]> {
  const submissions: Record<string, string[]> = {};
  for (const entry of actions ?? []) {
    if (entry.action.type === 'submit_answers' && Array.isArray(entry.action.answers)) {
      submissions[entry.playerId] = entry.action.answers.map((a) =>
        typeof a === 'string' ? a : '',
      );
    }
  }
  return submissions;
}

/** Trim, collapse internal whitespace, and lowercase for comparison. */
export function normalizeAnswer(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * First alphanumeric character of the answer, lowercased — used to check the
 * answer starts with the round letter. Leading punctuation/quotes are skipped.
 */
function firstLetterOf(answer: string): string | null {
  const match = normalizeAnswer(answer).match(/[a-z0-9]/);
  return match ? match[0] : null;
}

/** Valid = non-empty and starts with the round letter (case-insensitive). */
export function isValidAnswer(answer: unknown, letter: string): boolean {
  const first = firstLetterOf(typeof answer === 'string' ? answer : '');
  if (!first) return false;
  return first === letter.trim().toLowerCase();
}

/**
 * Tally a completed round. For each category, an entry is `unique` when it is
 * valid and no other player submitted the same normalized answer in that
 * category. Each unique entry scores POINTS_PER_UNIQUE for its player.
 */
export function tallyScattergories(
  submissions: Record<string, string[]>,
  letter: string,
  categories: string[],
  players: Player[],
): ScatterTally {
  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = 0;

  const perCategory: ScatterCategoryResult[] = categories.map((category, c) => {
    // Count how many players gave each normalized valid answer in this category.
    const counts = new Map<string, number>();
    for (const p of players) {
      const raw = submissions[p.id]?.[c] ?? '';
      if (!isValidAnswer(raw, letter)) continue;
      const norm = normalizeAnswer(raw);
      counts.set(norm, (counts.get(norm) ?? 0) + 1);
    }

    const entries: ScatterEntry[] = players.map((p) => {
      const raw = submissions[p.id]?.[c] ?? '';
      const valid = isValidAnswer(raw, letter);
      const unique = valid && counts.get(normalizeAnswer(raw)) === 1;
      if (unique) scores[p.id] += POINTS_PER_UNIQUE;
      return { playerId: p.id, answer: raw, valid, unique };
    });

    return { category, entries };
  });

  return { scores, perCategory };
}
