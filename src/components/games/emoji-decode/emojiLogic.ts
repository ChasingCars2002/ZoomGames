// ---------------------------------------------------------------------------
// Emoji Decode – pure game logic
//
// Players type guesses into a live chat. The round resolves deterministically:
// the first guess that matches the answer (or an accepted alias) wins. The view
// is a pure fold over the synced action log, so every client agrees on who won
// and which guesses were correct. The winner's speed-bonus points are computed
// by the host at round end (using live timeRemaining) and shipped in `final`.
// ---------------------------------------------------------------------------

export interface EmojiActionEntry {
  playerId: string;
  action: { type: string; guess?: string };
  timestamp: number;
}

export interface EmojiGuess {
  playerId: string;
  text: string;
  correct: boolean;
  timestamp: number;
}

export interface EmojiDerivedState {
  guesses: EmojiGuess[];
  outcome: 'pending' | 'won';
  winnerId: string | null;
}

export interface EmojiFinal {
  winnerId: string | null;
  pointsByPlayer: Record<string, number>;
}

/** Lowercase and strip everything but letters/digits/spaces; collapse spaces. */
export function normalizeGuess(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Space-insensitive comparison key, so "lionking" === "lion king". */
function tightKey(s: string): string {
  return normalizeGuess(s).replace(/\s/g, '');
}

/** A guess matches if it equals the answer or any alias (space-insensitive). */
export function matchEmojiGuess(
  guess: string,
  answer: string,
  aliases: string[] = [],
): boolean {
  const g = tightKey(guess);
  if (!g) return false;
  if (g === tightKey(answer)) return true;
  return aliases.some((a) => tightKey(a) === g);
}

/**
 * Fold the action log into the round view. Stops crediting a winner after the
 * first correct guess, but keeps recording later guesses as incorrect for the
 * chat feed.
 */
export function deriveEmojiState(
  rd: { answer: string; aliases?: string[]; actions?: EmojiActionEntry[] },
): EmojiDerivedState {
  const guesses: EmojiGuess[] = [];
  let outcome: 'pending' | 'won' = 'pending';
  let winnerId: string | null = null;

  for (const entry of rd.actions ?? []) {
    if (entry.action.type !== 'guess') continue;
    const text = String(entry.action.guess ?? '');
    if (!normalizeGuess(text)) continue;

    const correct = outcome === 'pending' && matchEmojiGuess(text, rd.answer, rd.aliases ?? []);
    guesses.push({ playerId: entry.playerId, text, correct, timestamp: entry.timestamp });

    if (correct) {
      outcome = 'won';
      winnerId = entry.playerId;
    }
  }

  return { guesses, outcome, winnerId };
}
