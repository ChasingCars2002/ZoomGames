import React, { useMemo } from 'react';

// ---------------------------------------------------------------------------
// WordHint – Shows blanks with progressive letter reveals
// ---------------------------------------------------------------------------

interface WordHintProps {
  /** The secret word being drawn */
  word: string;
  /** Seconds remaining in this round */
  timeRemaining: number;
  /** Total seconds for the round */
  totalTime: number;
  /** When true, show the full word (round ended) */
  revealed: boolean;
}

const WordHint: React.FC<WordHintProps> = ({
  word,
  timeRemaining,
  totalTime,
  revealed,
}) => {
  // Determine which character indices to reveal based on time fraction.
  // At 66% time remaining -> reveal first letter (index 0).
  // At 33% time remaining -> reveal one more random (deterministic) letter.
  const revealedIndices = useMemo(() => {
    if (revealed || !word) return new Set<number>();

    const elapsed = totalTime - timeRemaining;
    const fraction = totalTime > 0 ? elapsed / totalTime : 0;
    const indices = new Set<number>();

    // Only consider alphabetic positions for hints
    const letterPositions: number[] = [];
    for (let i = 0; i < word.length; i++) {
      if (/[a-zA-Z]/.test(word[i])) {
        letterPositions.push(i);
      }
    }

    if (letterPositions.length === 0) return indices;

    // After 34% of time has elapsed (i.e. 66% remaining), reveal first letter
    if (fraction >= 0.34) {
      indices.add(letterPositions[0]);
    }

    // After 67% of time has elapsed (i.e. 33% remaining), reveal another letter
    if (fraction >= 0.67 && letterPositions.length > 1) {
      // Pick a deterministic "random" letter: use middle of remaining positions
      const remaining = letterPositions.filter((i) => !indices.has(i));
      if (remaining.length > 0) {
        const mid = Math.floor(remaining.length / 2);
        indices.add(remaining[mid]);
      }
    }

    return indices;
  }, [word, timeRemaining, totalTime, revealed]);

  if (!word) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Category / length hint */}
      <span className="font-body text-xs text-white/40 uppercase tracking-wider">
        {word.length} letters
      </span>

      {/* Letters / blanks */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {word.split('').map((char, index) => {
          const isSpace = char === ' ';
          const isLetter = /[a-zA-Z]/.test(char);
          const showChar = revealed || !isLetter || revealedIndices.has(index);

          if (isSpace) {
            return (
              <div key={index} className="w-3" aria-label="space" />
            );
          }

          if (!isLetter) {
            // Non-letter, non-space characters (hyphens, apostrophes) always shown
            return (
              <div
                key={index}
                className="font-display text-2xl md:text-4xl text-white/60"
              >
                {char}
              </div>
            );
          }

          return (
            <div
              key={index}
              className={[
                'flex items-center justify-center',
                'w-8 h-10 md:w-11 md:h-14',
                'rounded-lg border-b-2 transition-all duration-300',
                revealed
                  ? 'bg-neon-green/15 border-neon-green/60'
                  : showChar
                    ? 'bg-neon-cyan/10 border-neon-cyan/40'
                    : 'bg-white/5 border-white/20',
              ].join(' ')}
            >
              <span
                className={[
                  'font-display text-2xl md:text-3xl uppercase select-none',
                  'transition-all duration-300',
                  revealed
                    ? 'text-neon-green'
                    : showChar
                      ? 'text-neon-cyan'
                      : 'text-transparent',
                ].join(' ')}
              >
                {showChar ? char : '_'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WordHint;
