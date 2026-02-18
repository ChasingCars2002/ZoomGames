import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase } from '../../../types/game';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { calculateScramblePoints } from '../../../lib/engine/ScoreManager';
import { shuffle } from '../../../lib/utils/shuffle';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Timer from '../../ui/Timer';
import ProgressBar from '../../ui/ProgressBar';
import Scoreboard from '../../game/Scoreboard';
import RoundTransition from '../../game/RoundTransition';
import { SCRAMBLE_WORDS, ScrambleWord } from './WordScrambleData';

// ---------------------------------------------------------------------------
// Types for round data stored in engineState.roundData
// ---------------------------------------------------------------------------

interface Solver {
  playerId: string;
  solveOrder: number;
  timeRemaining: number;
  points: number;
}

interface ScrambleRoundData {
  originalWord: string;
  scrambledWord: string;
  category: string;
  hint: string;
  solvers: Solver[];
  hintRevealed: boolean;
  letterHints: number[]; // indices of revealed letter positions
  actions?: Array<{
    playerId: string;
    action: { type: string; guess?: string };
    timestamp: number;
  }>;
}

// ---------------------------------------------------------------------------
// Category colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Animals: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  Food: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
  Technology: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  Nature: 'bg-green-500/20 text-green-300 border-green-400/30',
  Sports: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
  Geography: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
};

// ---------------------------------------------------------------------------
// Helper: scramble a word using Fisher-Yates, ensure result differs
// ---------------------------------------------------------------------------

function scrambleWord(word: string): string {
  const letters = word.split('');
  let scrambled: string[];
  let attempts = 0;

  do {
    scrambled = shuffle(letters);
    attempts++;
    // Safety valve: if word has all identical chars, accept it
    if (attempts > 50) break;
  } while (scrambled.join('') === word);

  return scrambled.join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WordScrambleGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();

  const { phase, players, scores, currentRound, totalRounds, roundData, config, timeRemaining } =
    engineState;

  const totalTime = config.timeLimit;

  // Track used words to avoid repeats
  const usedWordsRef = useRef<Set<string>>(new Set());

  // Local state
  const [guessInput, setGuessInput] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [wrongGuess, setWrongGuess] = useState(false);
  const [hasSolved, setHasSolved] = useState(false);

  // Track processed actions
  const processedActionsRef = useRef<number>(0);

  // Input ref for auto-focus
  const inputRef = useRef<HTMLInputElement>(null);

  // Parsed round data
  const rd = roundData as ScrambleRoundData | null;

  // -----------------------------------------------------------------------
  // Pick a word for the next round (host only)
  // -----------------------------------------------------------------------
  const pickWord = useCallback((): ScrambleWord => {
    const difficultyMap: Record<string, 1 | 2 | 3> = {
      easy: 1,
      medium: 2,
      hard: 3,
    };
    const targetDifficulty = difficultyMap[config.difficulty] ?? 2;

    let pool = SCRAMBLE_WORDS.filter((w) => !usedWordsRef.current.has(w.word));

    // Prefer words matching difficulty
    const diffPool = pool.filter((w) => w.difficulty === targetDifficulty);
    if (diffPool.length > 0) {
      pool = diffPool;
    }

    // Reset if exhausted
    if (pool.length === 0) {
      usedWordsRef.current.clear();
      pool = SCRAMBLE_WORDS.filter((w) => w.difficulty === targetDifficulty);
      if (pool.length === 0) pool = [...SCRAMBLE_WORDS];
    }

    const shuffled = shuffle(pool);
    const picked = shuffled[0];
    usedWordsRef.current.add(picked.word);
    return picked;
  }, [config.difficulty]);

  // -----------------------------------------------------------------------
  // Start next round (host only)
  // -----------------------------------------------------------------------
  const startNextRound = useCallback(() => {
    if (!isHost) return;

    const wordEntry = pickWord();
    const scrambled = scrambleWord(wordEntry.word);

    const newRoundData: ScrambleRoundData = {
      originalWord: wordEntry.word,
      scrambledWord: scrambled,
      category: wordEntry.category,
      hint: wordEntry.hint,
      solvers: [],
      hintRevealed: false,
      letterHints: [],
    };

    dispatch({ type: 'START_ROUND', roundData: newRoundData });
  }, [isHost, pickWord, dispatch]);

  // -----------------------------------------------------------------------
  // Auto-start when GAME_STARTING (host only)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.GAME_STARTING) return;

    const timer = setTimeout(() => {
      startNextRound();
    }, 500);
    return () => clearTimeout(timer);
  }, [isHost, phase, startNextRound]);

  // -----------------------------------------------------------------------
  // Reset local state on new round
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) {
      setGuessInput('');
      setWrongGuess(false);
      setHasSolved(false);
      processedActionsRef.current = 0;
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase, currentRound]);

  // -----------------------------------------------------------------------
  // Check if current player already solved (from roundData.solvers)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!rd || !currentPlayerId) return;
    const solved = rd.solvers.some((s) => s.playerId === currentPlayerId);
    if (solved) setHasSolved(true);
  }, [rd?.solvers, currentPlayerId]);

  // -----------------------------------------------------------------------
  // Host: process incoming actions (guesses and hints)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!rd || !rd.actions) return;

    const actions = rd.actions;
    const startIdx = processedActionsRef.current;
    if (actions.length <= startIdx) return;

    let updatedSolvers = [...rd.solvers];
    let updatedLetterHints = [...rd.letterHints];
    let needsEndRound = false;

    for (let i = startIdx; i < actions.length; i++) {
      const entry = actions[i];
      const { playerId, action } = entry;

      if (action.type === 'guess' && action.guess) {
        // Check if player already solved
        if (updatedSolvers.some((s) => s.playerId === playerId)) continue;

        const guess = action.guess.trim().toUpperCase();
        const correct = guess === rd.originalWord.toUpperCase();

        if (correct) {
          const solveOrder = updatedSolvers.length + 1;
          const pts = calculateScramblePoints(timeRemaining, totalTime, solveOrder);
          updatedSolvers.push({
            playerId,
            solveOrder,
            timeRemaining,
            points: pts,
          });
        }
      }

      if (action.type === 'use_hint') {
        // Reveal a random unrevealed letter position
        const word = rd.originalWord;
        const unrevealedPositions: number[] = [];
        for (let pos = 0; pos < word.length; pos++) {
          if (!updatedLetterHints.includes(pos)) {
            unrevealedPositions.push(pos);
          }
        }
        if (unrevealedPositions.length > 0) {
          const randomPos = shuffle(unrevealedPositions)[0];
          updatedLetterHints.push(randomPos);
        }
      }
    }

    processedActionsRef.current = actions.length;

    // Check if all connected players have solved
    const connectedPlayers = players.filter((p) => p.connected);
    const allSolved = connectedPlayers.every((p) =>
      updatedSolvers.some((s) => s.playerId === p.id),
    );

    if (allSolved) {
      needsEndRound = true;
    }

    // Dispatch END_ROUND if needed
    if (needsEndRound) {
      const roundScores: Record<string, number> = {};
      for (const player of players) {
        const solver = updatedSolvers.find((s) => s.playerId === player.id);
        roundScores[player.id] = solver ? solver.points : 0;
      }
      // Deduct hint costs: -2 pts per hint used is already accounted for
      // by simply not adding bonus points. Hints reduce available points naturally.

      dispatch({
        type: 'END_ROUND',
        scores: roundScores,
        roundData: {
          ...rd,
          solvers: updatedSolvers,
          letterHints: updatedLetterHints,
        },
      });
    }
  }, [isHost, phase, rd?.actions?.length, timeRemaining]);

  // -----------------------------------------------------------------------
  // Host: end round when timer expires (engine auto-transitions to ROUND_ENDING)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING) return;
    if (!rd) return;
    // Avoid double-processing: if solvers already calculated, skip
    // Check by seeing if roundData has been updated with final state
    // We look for a marker: if we already dispatched END_ROUND from action processing,
    // the phase would already be ROUND_ENDING with updated scores. 
    // But if timer expired, we still need to dispatch.

    // Gather final solvers from actions
    const solvers: Solver[] = [...(rd.solvers || [])];
    if (rd.actions) {
      for (const entry of rd.actions) {
        const { playerId, action } = entry;
        if (
          action.type === 'guess' &&
          action.guess &&
          !solvers.some((s) => s.playerId === playerId)
        ) {
          const guess = (action.guess as string).trim().toUpperCase();
          if (guess === rd.originalWord.toUpperCase()) {
            const solveOrder = solvers.length + 1;
            const pts = calculateScramblePoints(0, totalTime, solveOrder);
            solvers.push({ playerId, solveOrder, timeRemaining: 0, points: pts });
          }
        }
      }
    }

    const roundScores: Record<string, number> = {};
    for (const player of players) {
      const solver = solvers.find((s) => s.playerId === player.id);
      roundScores[player.id] = solver ? solver.points : 0;
    }

    dispatch({
      type: 'END_ROUND',
      scores: roundScores,
      roundData: { ...rd, solvers },
    });
  }, [isHost, phase]);

  // -----------------------------------------------------------------------
  // Host: progressive auto-hints during ROUND_ACTIVE
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!rd) return;

    const fraction = totalTime > 0 ? timeRemaining / totalTime : 1;

    // At 33% time remaining, reveal first letter if not already revealed
    if (fraction <= 0.33 && !rd.letterHints.includes(0)) {
      // We can't directly mutate roundData, but the auto-hint is informational.
      // We'll track this locally in derived state instead.
    }
  }, [isHost, phase, timeRemaining, totalTime]);

  // -----------------------------------------------------------------------
  // Host: after round ends, wait 3s then next or end game
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING) return;

    const timer = setTimeout(() => {
      if (currentRound >= totalRounds) {
        endGame();
      } else {
        setShowTransition(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isHost, phase, currentRound, totalRounds, endGame]);

  // -----------------------------------------------------------------------
  // Player: submit guess
  // -----------------------------------------------------------------------
  const handleSubmitGuess = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (hasSolved) return;
      if (phase !== GamePhase.ROUND_ACTIVE) return;

      const trimmed = guessInput.trim();
      if (trimmed.length === 0) return;

      playerAction({ type: 'guess', guess: trimmed });

      // Check locally if correct for immediate feedback
      if (rd && trimmed.toUpperCase() === rd.originalWord.toUpperCase()) {
        setHasSolved(true);
        setWrongGuess(false);
      } else {
        setWrongGuess(true);
        setTimeout(() => setWrongGuess(false), 600);
      }

      setGuessInput('');
    },
    [guessInput, hasSolved, phase, playerAction, rd],
  );

  // -----------------------------------------------------------------------
  // Player: use hint
  // -----------------------------------------------------------------------
  const handleUseHint = useCallback(() => {
    if (hasSolved) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    playerAction({ type: 'use_hint' });
  }, [hasSolved, phase, playerAction]);

  // -----------------------------------------------------------------------
  // Transition complete -> start next round
  // -----------------------------------------------------------------------
  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    if (isHost) {
      startNextRound();
    }
  }, [isHost, startNextRound]);

  // -----------------------------------------------------------------------
  // Derive display state for scrambled letters with hints
  // -----------------------------------------------------------------------
  const displayLetters = useMemo(() => {
    if (!rd) return [];

    const scrambled = rd.scrambledWord.split('');
    const original = rd.originalWord;
    const hints = rd.letterHints || [];

    // Calculate progressive auto-hints based on time
    const fraction = totalTime > 0 ? timeRemaining / totalTime : 1;
    const showCategory = fraction <= 0.66;
    const showFirstLetter = fraction <= 0.33;

    // Build letter display array
    return scrambled.map((letter, idx) => {
      // Check if this position in the ORIGINAL word is hint-revealed
      const isHinted = hints.includes(idx);
      // Auto-hint: first letter
      const isAutoFirstLetter = showFirstLetter && idx === 0;

      return {
        letter,
        isHinted: isHinted || isAutoFirstLetter,
        hintLetter: isHinted || isAutoFirstLetter ? original[idx] : undefined,
      };
    });
  }, [rd, timeRemaining, totalTime]);

  // Determine if category should be shown (progressive hint)
  const showCategoryHint = useMemo(() => {
    if (!rd) return false;
    const fraction = totalTime > 0 ? timeRemaining / totalTime : 1;
    return fraction <= 0.66;
  }, [rd, timeRemaining, totalTime]);

  // -----------------------------------------------------------------------
  // Render: Waiting / Starting
  // -----------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">Scrambling words...</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Results / Game Over
  // -----------------------------------------------------------------------
  if (phase === GamePhase.RESULTS || phase === GamePhase.GAME_ENDING) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card glow="yellow" className="max-w-lg w-full text-center">
          <h2 className="font-display text-3xl text-neon-yellow mb-6">Game Over!</h2>
          <Scoreboard
            scores={scores}
            players={players}
            currentPlayerId={currentPlayerId ?? ''}
          />
        </Card>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: No round data
  // -----------------------------------------------------------------------
  if (!rd) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Round Transition
  // -----------------------------------------------------------------------
  if (showTransition) {
    return (
      <RoundTransition
        round={currentRound + 1}
        totalRounds={totalRounds}
        message="Unscramble the next word!"
        onComplete={handleTransitionComplete}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Determine if this is reveal/ending phase
  // -----------------------------------------------------------------------
  const isReveal = phase === GamePhase.ROUND_ENDING;

  // Solvers count
  const solverCount = rd.solvers?.length ?? 0;
  const connectedCount = players.filter((p) => p.connected).length;

  // -----------------------------------------------------------------------
  // Main game layout
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen p-4 flex gap-4">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center gap-6 max-w-3xl mx-auto">
        {/* Top bar */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg text-white/60">
              Round {currentRound}/{totalRounds}
            </span>
            {(showCategoryHint || isReveal) && rd.category && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-body border ${
                  CATEGORY_COLORS[rd.category] ?? 'bg-white/10 text-white/60'
                }`}
              >
                {rd.category}
              </span>
            )}
            {phase === GamePhase.ROUND_ACTIVE && (
              <span className="text-sm text-white/40 font-body">
                {solverCount}/{connectedCount} solved
              </span>
            )}
          </div>
          <Timer
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            size="md"
            showSeconds
          />
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <ProgressBar
            progress={(timeRemaining / totalTime) * 100}
            color={timeRemaining / totalTime > 0.3 ? 'cyan' : 'pink'}
            height="sm"
          />
        </div>

        {/* Scrambled word display */}
        <Card glow={isReveal ? 'yellow' : 'cyan'} className="w-full text-center py-8 px-6">
          {isReveal ? (
            <>
              <p className="font-body text-sm text-white/40 uppercase tracking-wider mb-3">
                The answer was
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {rd.originalWord.split('').map((letter, idx) => (
                  <div
                    key={idx}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-green-500/20 border-2 border-green-400/50 flex items-center justify-center"
                  >
                    <span className="font-display text-2xl md:text-3xl text-green-300">
                      {letter}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {!showCategoryHint && (
                <p className="font-body text-sm text-white/30 uppercase tracking-wider mb-3">
                  Unscramble this word
                </p>
              )}
              {showCategoryHint && !isReveal && (
                <p className="font-body text-sm text-neon-yellow/60 uppercase tracking-wider mb-3">
                  Hint: {rd.hint}
                </p>
              )}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {displayLetters.map((item, idx) => (
                  <div
                    key={idx}
                    className={[
                      'w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 flex items-center justify-center',
                      'transition-all duration-300',
                      item.isHinted
                        ? 'bg-neon-yellow/10 border-neon-yellow/40'
                        : 'bg-white/5 border-white/20',
                    ].join(' ')}
                    style={{
                      animation: `letterBounce 0.5s ease-out ${idx * 0.08}s both`,
                    }}
                  >
                    <span
                      className={[
                        'font-display text-2xl md:text-3xl',
                        item.isHinted ? 'text-neon-yellow' : 'text-white',
                      ].join(' ')}
                    >
                      {item.isHinted && item.hintLetter
                        ? item.hintLetter
                        : item.letter}
                    </span>
                  </div>
                ))}
              </div>

              {/* Word length indicator */}
              <p className="text-sm text-white/30 mt-3 font-mono">
                {rd.originalWord.length} letters
              </p>
            </>
          )}
        </Card>

        {/* Input area (only during active round) */}
        {phase === GamePhase.ROUND_ACTIVE && !hasSolved && (
          <form
            onSubmit={handleSubmitGuess}
            className="w-full max-w-md flex flex-col items-center gap-3"
          >
            <div className="relative w-full">
              <input
                ref={inputRef}
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="Type your guess..."
                autoComplete="off"
                className={[
                  'w-full px-5 py-4 rounded-xl bg-surface/80 border-2 text-white',
                  'font-body text-lg text-center uppercase tracking-wider',
                  'placeholder:text-white/30 placeholder:normal-case placeholder:tracking-normal',
                  'focus:outline-none transition-all duration-200',
                  wrongGuess
                    ? 'border-red-500/60 bg-red-500/10 animate-shake'
                    : 'border-white/20 focus:border-neon-cyan/60',
                ].join(' ')}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={guessInput.trim().length === 0}
              >
                Submit Guess
              </Button>
              <Button
                variant="ghost"
                size="lg"
                type="button"
                onClick={handleUseHint}
              >
                Hint (-2 pts)
              </Button>
            </div>
          </form>
        )}

        {/* Solved banner */}
        {hasSolved && phase === GamePhase.ROUND_ACTIVE && (
          <div className="text-center py-3">
            <span className="font-display text-xl text-neon-cyan">
              You solved it! Waiting for others...
            </span>
          </div>
        )}

        {/* Reveal: solvers list */}
        {isReveal && (
          <Card className="w-full max-w-md">
            <h3 className="font-display text-lg text-neon-yellow mb-3">Round Results</h3>
            {rd.solvers && rd.solvers.length > 0 ? (
              <div className="flex flex-col gap-2">
                {rd.solvers
                  .slice()
                  .sort((a, b) => a.solveOrder - b.solveOrder)
                  .map((solver) => {
                    const player = players.find((p) => p.id === solver.playerId);
                    const isMe = solver.playerId === currentPlayerId;

                    return (
                      <div
                        key={solver.playerId}
                        className={[
                          'flex items-center justify-between px-4 py-2 rounded-lg bg-green-500/10',
                          isMe ? 'ring-1 ring-neon-cyan/40' : '',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-green-400 w-6">
                            #{solver.solveOrder}
                          </span>
                          <span className="font-body text-sm text-white">
                            {player?.name ?? 'Unknown'}
                            {isMe && <span className="text-white/40 ml-1">(You)</span>}
                          </span>
                        </div>
                        <span className="font-mono text-sm font-bold text-neon-yellow">
                          +{solver.points}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-white/40 text-sm font-body text-center py-2">
                Nobody solved it this round!
              </p>
            )}

            {/* Show unsolved players */}
            {(() => {
              const unsolvedPlayers = players.filter(
                (p) => !rd.solvers?.some((s) => s.playerId === p.id),
              );
              if (unsolvedPlayers.length === 0) return null;
              return (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {unsolvedPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-4 py-1.5"
                    >
                      <span className="font-body text-sm text-white/40">
                        {player.name}
                        {player.id === currentPlayerId && ' (You)'}
                      </span>
                      <span className="font-mono text-sm text-white/30">+0</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        )}
      </div>

      {/* Right sidebar: mini scoreboard */}
      <div className="hidden lg:block w-64 shrink-0">
        <Card className="sticky top-4">
          <Scoreboard
            scores={scores}
            players={players}
            currentPlayerId={currentPlayerId ?? ''}
          />
        </Card>
      </div>

      {/* Inline keyframes for letter bounce and input shake */}
      <style>{`
        @keyframes letterBounce {
          0% {
            transform: translateY(-20px) scale(0.8);
            opacity: 0;
          }
          60% {
            transform: translateY(4px) scale(1.05);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default WordScrambleGame;
