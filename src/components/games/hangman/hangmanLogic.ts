// ---------------------------------------------------------------------------
// Team Hangman – pure game logic
//
// The round state is derived deterministically from the ordered action log
// stored in roundData.actions. Because the host appends actions in arrival
// order and broadcasts the same log to every client, folding the log with
// deriveHangmanState produces an identical view on every screen — no
// mid-round writes or conflict resolution needed.
// ---------------------------------------------------------------------------

export const MAX_WRONG = 6;
export const LETTER_POINTS = 15; // per revealed occurrence
export const SOLVE_POINTS_PER_HIDDEN = 20; // full-word solve, per hidden letter
export const SOLVE_MIN_POINTS = 40;
export const TEAM_WIN_BONUS = 25; // every connected player, if the team wins

export interface HangmanActionEntry {
  playerId: string;
  action: { type: string; letter?: string; guess?: string };
  timestamp: number;
}

export interface HangmanRoundData {
  word: string; // uppercase; may contain spaces/hyphens/apostrophes
  category: string;
  maxWrong: number;
  actions?: HangmanActionEntry[];
  final?: HangmanDerivedState; // snapshot attached at END_ROUND
}

export interface LetterGuess {
  letter: string;
  playerId: string;
  correct: boolean;
}

export interface WordAttempt {
  playerId: string;
  guess: string;
  correct: boolean;
}

export type HangmanOutcome = 'pending' | 'won' | 'lost';

export interface HangmanDerivedState {
  letterGuesses: LetterGuess[];
  wordAttempts: WordAttempt[];
  wrongCount: number;
  revealedLetters: string[];
  outcome: HangmanOutcome;
  solverId: string | null; // player whose guess completed the word
  pointsByPlayer: Record<string, number>;
}

/** Returns a single uppercase A–Z character, or null if invalid. */
export function normalizeLetter(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().toUpperCase();
  return /^[A-Z]$/.test(trimmed) ? trimmed : null;
}

/** Letters-only uppercase form, so "Reply-All!" matches "REPLY ALL". */
export function normalizeWordGuess(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.toUpperCase().replace(/[^A-Z]/g, '');
}

/** Unique A–Z letters appearing in the word. */
export function lettersInWord(word: string): Set<string> {
  return new Set(word.toUpperCase().split('').filter((c) => /[A-Z]/.test(c)));
}

/** Count of letter positions still hidden given the revealed set. */
export function hiddenLetterCount(word: string, revealed: Set<string>): number {
  let hidden = 0;
  for (const ch of word.toUpperCase()) {
    if (/[A-Z]/.test(ch) && !revealed.has(ch)) hidden++;
  }
  return hidden;
}

export function isFullyRevealed(word: string, revealed: Set<string>): boolean {
  return hiddenLetterCount(word, revealed) === 0;
}

/**
 * Display tiles for the word: hidden letters become null, revealed letters
 * and non-letters (spaces, hyphens) keep their character.
 */
export function maskWord(word: string, revealed: Set<string>): (string | null)[] {
  return word
    .toUpperCase()
    .split('')
    .map((ch) => {
      if (!/[A-Z]/.test(ch)) return ch;
      return revealed.has(ch) ? ch : null;
    });
}

function addPoints(points: Record<string, number>, playerId: string, amount: number) {
  points[playerId] = (points[playerId] ?? 0) + amount;
}

/** Fold the ordered action log into the authoritative round state. */
export function deriveHangmanState(rd: HangmanRoundData): HangmanDerivedState {
  const word = rd.word.toUpperCase();
  const wordLetters = lettersInWord(word);
  const maxWrong = rd.maxWrong > 0 ? rd.maxWrong : MAX_WRONG;

  const letterGuesses: LetterGuess[] = [];
  const wordAttempts: WordAttempt[] = [];
  const revealed = new Set<string>();
  const pointsByPlayer: Record<string, number> = {};
  let wrongCount = 0;
  let outcome: HangmanOutcome = 'pending';
  let solverId: string | null = null;

  for (const entry of rd.actions ?? []) {
    if (outcome !== 'pending') break;
    const { playerId, action } = entry;

    if (action.type === 'guess_letter') {
      const letter = normalizeLetter(action.letter);
      if (!letter) continue;
      if (letterGuesses.some((g) => g.letter === letter)) continue; // duplicate

      const correct = wordLetters.has(letter);
      letterGuesses.push({ letter, playerId, correct });

      if (correct) {
        revealed.add(letter);
        const occurrences = word.split('').filter((c) => c === letter).length;
        addPoints(pointsByPlayer, playerId, LETTER_POINTS * occurrences);
        if (isFullyRevealed(word, revealed)) {
          outcome = 'won';
          solverId = playerId;
        }
      } else {
        wrongCount++;
        if (wrongCount >= maxWrong) outcome = 'lost';
      }
    }

    if (action.type === 'guess') {
      const guess = normalizeWordGuess(action.guess);
      if (!guess) continue;

      const correct = guess === normalizeWordGuess(word);
      wordAttempts.push({ playerId, guess, correct });

      if (correct) {
        const hidden = hiddenLetterCount(word, revealed);
        addPoints(
          pointsByPlayer,
          playerId,
          Math.max(SOLVE_MIN_POINTS, SOLVE_POINTS_PER_HIDDEN * hidden),
        );
        for (const l of wordLetters) revealed.add(l);
        outcome = 'won';
        solverId = playerId;
      } else {
        // A failed solve attempt costs the team a strike, classic rules.
        wrongCount++;
        if (wrongCount >= maxWrong) outcome = 'lost';
      }
    }
  }

  return {
    letterGuesses,
    wordAttempts,
    wrongCount,
    revealedLetters: [...revealed],
    outcome,
    solverId,
    pointsByPlayer,
  };
}
