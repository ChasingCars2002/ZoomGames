// ---------------------------------------------------------------------------
// ScoreManager – Pure scoring utility functions
// ---------------------------------------------------------------------------

/**
 * Calculate a speed bonus multiplier based on how much time remains.
 * Ranges from 1.0 (no time left) to 2.0 (full time remaining).
 *
 * @param timeRemaining - seconds left on the clock
 * @param totalTime     - total seconds allowed for the round
 * @returns bonus multiplier between 1.0 and 2.0
 */
export function calculateSpeedBonus(timeRemaining: number, totalTime: number): number {
  if (totalTime <= 0) return 1.0;

  const fraction = Math.max(0, Math.min(timeRemaining, totalTime)) / totalTime;

  // Linear scale: 1.0 at 0% remaining → 2.0 at 100% remaining
  return 1.0 + fraction;
}

/**
 * Calculate points for a correct guess in Pictionary / Charades.
 *
 * Base: 500 points
 * Speed bonus: up to 2x for instant guesses
 * Order penalty: each subsequent guesser receives 10% fewer points than the
 *                previous one (guessOrder is 1-indexed: 1 = first guesser).
 *
 * @param timeRemaining - seconds left when the guess was made
 * @param totalTime     - total seconds allowed for the round
 * @param guessOrder    - 1 for the first correct guesser, 2 for the second, etc.
 * @returns integer point value
 */
export function calculateGuessPoints(
  timeRemaining: number,
  totalTime: number,
  guessOrder: number,
): number {
  const BASE_POINTS = 500;
  const DIMINISH_FACTOR = 0.1; // 10% reduction per subsequent guesser

  const speedBonus = calculateSpeedBonus(timeRemaining, totalTime);

  // guessOrder is 1-indexed; first guesser gets full points
  const orderMultiplier = Math.max(0, 1 - DIMINISH_FACTOR * (guessOrder - 1));

  return Math.round(BASE_POINTS * speedBonus * orderMultiplier);
}

/**
 * Calculate points for a trivia answer.
 *
 * Correct answers receive 1000 base points with a speed bonus.
 * Incorrect answers receive 0 points.
 *
 * @param timeRemaining - seconds left when the answer was submitted
 * @param totalTime     - total seconds allowed for the question
 * @param isCorrect     - whether the answer was correct
 * @returns integer point value
 */
export function calculateTriviaPoints(
  timeRemaining: number,
  totalTime: number,
  isCorrect: boolean,
): number {
  if (!isCorrect) return 0;

  const BASE_POINTS = 1000;
  const speedBonus = calculateSpeedBonus(timeRemaining, totalTime);

  return Math.round(BASE_POINTS * speedBonus);
}

/**
 * Calculate points for solving a word scramble.
 *
 * Base: 750 points
 * Speed bonus: up to 2x for instant solves
 * Order penalty: each subsequent solver receives 15% fewer points than the
 *                previous one (solveOrder is 1-indexed).
 *
 * @param timeRemaining - seconds left when the word was unscrambled
 * @param totalTime     - total seconds allowed for the round
 * @param solveOrder    - 1 for the first solver, 2 for the second, etc.
 * @returns integer point value
 */
export function calculateScramblePoints(
  timeRemaining: number,
  totalTime: number,
  solveOrder: number,
): number {
  const BASE_POINTS = 750;
  const DIMINISH_FACTOR = 0.15; // 15% reduction per subsequent solver

  const speedBonus = calculateSpeedBonus(timeRemaining, totalTime);

  const orderMultiplier = Math.max(0, 1 - DIMINISH_FACTOR * (solveOrder - 1));

  return Math.round(BASE_POINTS * speedBonus * orderMultiplier);
}

/**
 * Merge round scores into existing cumulative scores.
 * Creates new entries for players who didn't previously have a score.
 *
 * @param existing    - cumulative scores so far
 * @param roundScores - scores earned this round
 * @returns new merged scores object (does not mutate inputs)
 */
export function mergeScores(
  existing: Record<string, number>,
  roundScores: Record<string, number>,
): Record<string, number> {
  const merged = { ...existing };

  for (const [playerId, points] of Object.entries(roundScores)) {
    merged[playerId] = (merged[playerId] ?? 0) + points;
  }

  return merged;
}
