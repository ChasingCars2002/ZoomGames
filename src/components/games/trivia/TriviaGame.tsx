import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase } from '../../../types/game';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { calculateTriviaPoints } from '../../../lib/engine/ScoreManager';
import { shuffle } from '../../../lib/utils/shuffle';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Timer from '../../ui/Timer';
import Scoreboard from '../../game/Scoreboard';
import RoundTransition from '../../game/RoundTransition';
import { TRIVIA_QUESTIONS, TriviaQuestion } from './TriviaData';

// ---------------------------------------------------------------------------
// Types for round data stored in engineState.roundData
// ---------------------------------------------------------------------------

interface PlayerAnswer {
  answerIndex: number;
  timestamp: number;
  timeRemaining: number;
}

interface TriviaRoundData {
  question: TriviaQuestion;
  answers: [string, string, string, string];
  correctIndex: number;
  playerAnswers: Record<string, PlayerAnswer>;
  revealAnswer: boolean;
  actions?: Array<{
    playerId: string;
    action: { type: string; answerIndex?: number; timestamp?: number };
    timestamp: number;
  }>;
}

// ---------------------------------------------------------------------------
// Answer button color schemes
// ---------------------------------------------------------------------------

const ANSWER_COLORS = [
  {
    label: 'A',
    base: 'bg-blue-600 hover:bg-blue-500 border-blue-400/40',
    selected: 'bg-blue-500 ring-2 ring-blue-300',
    correct: 'bg-green-600 border-green-400/60 ring-2 ring-green-300',
    wrong: 'bg-red-600/60 border-red-400/40 opacity-60',
  },
  {
    label: 'B',
    base: 'bg-orange-600 hover:bg-orange-500 border-orange-400/40',
    selected: 'bg-orange-500 ring-2 ring-orange-300',
    correct: 'bg-green-600 border-green-400/60 ring-2 ring-green-300',
    wrong: 'bg-red-600/60 border-red-400/40 opacity-60',
  },
  {
    label: 'C',
    base: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/40',
    selected: 'bg-emerald-500 ring-2 ring-emerald-300',
    correct: 'bg-green-600 border-green-400/60 ring-2 ring-green-300',
    wrong: 'bg-red-600/60 border-red-400/40 opacity-60',
  },
  {
    label: 'D',
    base: 'bg-purple-600 hover:bg-purple-500 border-purple-400/40',
    selected: 'bg-purple-500 ring-2 ring-purple-300',
    correct: 'bg-green-600 border-green-400/60 ring-2 ring-green-300',
    wrong: 'bg-red-600/60 border-red-400/40 opacity-60',
  },
];

// ---------------------------------------------------------------------------
// Category badge colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  'Pop Culture': 'bg-pink-500/20 text-pink-300 border-pink-400/30',
  Sports: 'bg-green-500/20 text-green-300 border-green-400/30',
  Science: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  History: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  Food: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TriviaGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();

  const { phase, players, scores, currentRound, totalRounds, roundData, config, timeRemaining } =
    engineState;

  const totalTime = config.timeLimit;

  // Track which questions have been used to avoid repeats
  const usedQuestionIdsRef = useRef<Set<string>>(new Set());

  // Local state: the answer this player selected (resets each round)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Local state: show round transition overlay
  const [showTransition, setShowTransition] = useState(false);

  // Track processed actions to avoid duplicates
  const processedActionsRef = useRef<number>(0);

  // Parsed round data
  const rd = roundData as TriviaRoundData | null;

  // -----------------------------------------------------------------------
  // Pick a question for the next round (host only)
  // -----------------------------------------------------------------------
  const pickQuestion = useCallback((): TriviaQuestion => {
    // Filter by difficulty if configured
    const difficultyFilter = config.difficulty;
    let pool = TRIVIA_QUESTIONS.filter((q) => !usedQuestionIdsRef.current.has(q.id));

    // If we have difficulty-matching questions, prefer them
    const difficultyPool = pool.filter((q) => q.difficulty === difficultyFilter);
    if (difficultyPool.length > 0) {
      pool = difficultyPool;
    }

    // If all questions used, reset pool
    if (pool.length === 0) {
      usedQuestionIdsRef.current.clear();
      pool = TRIVIA_QUESTIONS.filter((q) => q.difficulty === difficultyFilter);
      if (pool.length === 0) pool = [...TRIVIA_QUESTIONS];
    }

    const shuffled = shuffle(pool);
    const picked = shuffled[0];
    usedQuestionIdsRef.current.add(picked.id);
    return picked;
  }, [config.difficulty]);

  // -----------------------------------------------------------------------
  // Start a round (host only): shuffle answers and dispatch START_ROUND
  // -----------------------------------------------------------------------
  const startNextRound = useCallback(() => {
    if (!isHost) return;

    const question = pickQuestion();

    // Create index mapping for shuffled answers
    const indexMap = shuffle([0, 1, 2, 3]);
    const shuffledAnswers: [string, string, string, string] = [
      question.answers[indexMap[0]],
      question.answers[indexMap[1]],
      question.answers[indexMap[2]],
      question.answers[indexMap[3]],
    ];
    const newCorrectIndex = indexMap.indexOf(question.correctIndex);

    const newRoundData: TriviaRoundData = {
      question,
      answers: shuffledAnswers,
      correctIndex: newCorrectIndex,
      playerAnswers: {},
      revealAnswer: false,
    };

    dispatch({ type: 'START_ROUND', roundData: newRoundData });
  }, [isHost, pickQuestion, dispatch]);

  // -----------------------------------------------------------------------
  // Auto-start round when phase is GAME_STARTING (host only)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.GAME_STARTING) return;

    // Small delay before first round
    const timer = setTimeout(() => {
      startNextRound();
    }, 500);
    return () => clearTimeout(timer);
  }, [isHost, phase, startNextRound]);

  // -----------------------------------------------------------------------
  // Reset selected answer when a new round starts
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) {
      setSelectedAnswer(null);
      processedActionsRef.current = 0;
    }
  }, [phase, currentRound]);

  // -----------------------------------------------------------------------
  // Host: monitor roundData.actions for player answers
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!rd || !rd.actions) return;

    const actions = rd.actions;
    const startIdx = processedActionsRef.current;

    if (actions.length <= startIdx) return;

    // Process new actions
    let updatedPlayerAnswers = { ...rd.playerAnswers };
    let hasNewAnswers = false;

    for (let i = startIdx; i < actions.length; i++) {
      const entry = actions[i];
      const { playerId, action } = entry;

      if (action.type === 'answer' && updatedPlayerAnswers[playerId] === undefined) {
        updatedPlayerAnswers[playerId] = {
          answerIndex: action.answerIndex as number,
          timestamp: action.timestamp as number,
          timeRemaining: timeRemaining,
        };
        hasNewAnswers = true;
      }
    }

    processedActionsRef.current = actions.length;

    if (hasNewAnswers) {
      // Update roundData with playerAnswers via END_ROUND when conditions met,
      // or just track locally. We dispatch a new START_ROUND-like update?
      // Actually, the engine doesn't have an UPDATE_ROUND_DATA action.
      // We track locally and use it when ending the round.
    }

    // Check if all players have answered
    const connectedPlayers = players.filter((p) => p.connected);
    const allAnswered = connectedPlayers.every(
      (p) => updatedPlayerAnswers[p.id] !== undefined,
    );

    if (allAnswered) {
      // End round immediately
      endRoundWithScores(updatedPlayerAnswers);
    }
  }, [isHost, phase, rd?.actions?.length, timeRemaining]);

  // -----------------------------------------------------------------------
  // Host: end round when timer reaches 0 (phase transitions to ROUND_ENDING)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    // The engine auto-transitions to ROUND_ENDING when TICK reaches 0
    // We need to dispatch END_ROUND with scores
    if (phase !== GamePhase.ROUND_ENDING) return;
    if (!rd) return;
    // Only fire once - if revealAnswer already true, we already processed
    if (rd.revealAnswer) return;

    // Gather answers from actions
    const playerAnswers: Record<string, PlayerAnswer> = { ...rd.playerAnswers };
    if (rd.actions) {
      for (const entry of rd.actions) {
        const { playerId, action } = entry;
        if (action.type === 'answer' && playerAnswers[playerId] === undefined) {
          playerAnswers[playerId] = {
            answerIndex: action.answerIndex as number,
            timestamp: action.timestamp as number,
            timeRemaining: 0,
          };
        }
      }
    }

    endRoundWithScores(playerAnswers);
  }, [isHost, phase]);

  // -----------------------------------------------------------------------
  // Calculate and dispatch END_ROUND scores
  // -----------------------------------------------------------------------
  const endRoundWithScores = useCallback(
    (playerAnswers: Record<string, PlayerAnswer>) => {
      if (!rd) return;

      const roundScores: Record<string, number> = {};

      for (const player of players) {
        const answer = playerAnswers[player.id];
        if (!answer) {
          roundScores[player.id] = 0;
          continue;
        }

        const isCorrect = answer.answerIndex === rd.correctIndex;
        const pts = calculateTriviaPoints(answer.timeRemaining, totalTime, isCorrect);
        roundScores[player.id] = pts;
      }

      const updatedRoundData: TriviaRoundData = {
        ...rd,
        playerAnswers,
        revealAnswer: true,
      };

      dispatch({ type: 'END_ROUND', scores: roundScores, roundData: updatedRoundData });
    },
    [rd, players, totalTime, dispatch],
  );

  // -----------------------------------------------------------------------
  // Host: after ROUND_ENDING (with reveal), wait 3s then next round or end
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING) return;
    if (!rd?.revealAnswer) return;

    const timer = setTimeout(() => {
      if (currentRound >= totalRounds) {
        endGame();
      } else {
        setShowTransition(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isHost, phase, rd?.revealAnswer, currentRound, totalRounds, endGame]);

  // -----------------------------------------------------------------------
  // Player: submit answer
  // -----------------------------------------------------------------------
  const handleAnswerClick = useCallback(
    (answerIndex: number) => {
      if (selectedAnswer !== null) return; // Already answered
      if (phase !== GamePhase.ROUND_ACTIVE) return;

      setSelectedAnswer(answerIndex);
      playerAction({ type: 'answer', answerIndex, timestamp: Date.now() });
    },
    [selectedAnswer, phase, playerAction],
  );

  // -----------------------------------------------------------------------
  // Round transition complete -> start next round
  // -----------------------------------------------------------------------
  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    if (isHost) {
      startNextRound();
    }
  }, [isHost, startNextRound]);

  // -----------------------------------------------------------------------
  // Derive answer stats for the reveal phase
  // -----------------------------------------------------------------------
  const answerStats = useMemo(() => {
    if (!rd?.revealAnswer || !rd.playerAnswers) return null;

    const stats: { count: number; playerNames: string[] }[] = [
      { count: 0, playerNames: [] },
      { count: 0, playerNames: [] },
      { count: 0, playerNames: [] },
      { count: 0, playerNames: [] },
    ];

    for (const [playerId, answer] of Object.entries(rd.playerAnswers)) {
      const idx = answer.answerIndex;
      if (idx >= 0 && idx < 4) {
        stats[idx].count++;
        const player = players.find((p) => p.id === playerId);
        if (player) stats[idx].playerNames.push(player.name);
      }
    }

    return stats;
  }, [rd?.revealAnswer, rd?.playerAnswers, players]);

  // -----------------------------------------------------------------------
  // Derive round points for each player (for reveal display)
  // -----------------------------------------------------------------------
  const roundPoints = useMemo(() => {
    if (!rd?.revealAnswer || !rd.playerAnswers) return {};

    const pts: Record<string, number> = {};
    for (const player of players) {
      const answer = rd.playerAnswers[player.id];
      if (!answer) {
        pts[player.id] = 0;
        continue;
      }
      const isCorrect = answer.answerIndex === rd.correctIndex;
      pts[player.id] = calculateTriviaPoints(answer.timeRemaining, totalTime, isCorrect);
    }
    return pts;
  }, [rd?.revealAnswer, rd?.playerAnswers, rd?.correctIndex, players, totalTime]);

  // -----------------------------------------------------------------------
  // Count how many players have answered (for host status display)
  // -----------------------------------------------------------------------
  const answeredCount = useMemo(() => {
    if (!rd?.actions) return 0;
    const uniquePlayers = new Set<string>();
    for (const entry of rd.actions) {
      if (entry.action.type === 'answer') {
        uniquePlayers.add(entry.playerId);
      }
    }
    return uniquePlayers.size;
  }, [rd?.actions]);

  // -----------------------------------------------------------------------
  // Render: Waiting / Starting
  // -----------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">Preparing questions...</p>
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
  // Render: No round data yet
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
        message="Next question incoming!"
        onComplete={handleTransitionComplete}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Determine if this is reveal phase
  // -----------------------------------------------------------------------
  const isReveal = rd.revealAnswer && phase === GamePhase.ROUND_ENDING;

  // -----------------------------------------------------------------------
  // Main game layout
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen p-4 flex gap-4">
      {/* Main content area */}
      <div className="flex-1 flex flex-col gap-4 max-w-4xl mx-auto">
        {/* Top bar: round info + timer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg text-white/60">
              Round {currentRound}/{totalRounds}
            </span>
            {rd.question.category && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-body border ${
                  CATEGORY_COLORS[rd.question.category] ?? 'bg-white/10 text-white/60'
                }`}
              >
                {rd.question.category}
              </span>
            )}
            {phase === GamePhase.ROUND_ACTIVE && (
              <span className="text-sm text-white/40 font-body">
                {answeredCount}/{players.filter((p) => p.connected).length} answered
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

        {/* Question card */}
        <Card glow={isReveal ? 'yellow' : 'cyan'} className="text-center py-8 px-6">
          <h2 className="font-display text-2xl md:text-3xl text-white leading-relaxed">
            {rd.question.question}
          </h2>
        </Card>

        {/* Answer grid: 2x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rd.answers.map((answer, idx) => {
            const color = ANSWER_COLORS[idx];
            const isSelected = selectedAnswer === idx;
            const isCorrectAnswer = idx === rd.correctIndex;

            let btnClass = '';
            if (isReveal) {
              if (isCorrectAnswer) {
                btnClass = color.correct;
              } else {
                btnClass = color.wrong;
              }
              // Highlight the player's wrong pick with a distinctive style
              if (isSelected && !isCorrectAnswer) {
                btnClass += ' ring-2 ring-red-400 ring-offset-2 ring-offset-navy-900';
              }
            } else if (isSelected) {
              btnClass = color.selected;
            } else {
              btnClass = color.base;
            }

            const isDisabled =
              selectedAnswer !== null || phase !== GamePhase.ROUND_ACTIVE;

            return (
              <button
                key={idx}
                disabled={isDisabled}
                onClick={() => handleAnswerClick(idx)}
                className={[
                  'relative flex items-center gap-4 p-5 rounded-xl border text-left',
                  'transition-all duration-200 ease-out',
                  'disabled:cursor-default',
                  !isDisabled && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                  btnClass,
                ].join(' ')}
              >
                {/* Letter label */}
                <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center font-display text-lg text-white">
                  {color.label}
                </span>

                {/* Answer text */}
                <span className="font-body text-base md:text-lg text-white flex-1">
                  {answer}
                </span>

                {/* Reveal: check / X icon */}
                {isReveal && isCorrectAnswer && (
                  <span className="text-2xl" aria-label="Correct">
                    &#10003;
                  </span>
                )}
                {isReveal && isSelected && !isCorrectAnswer && (
                  <span className="text-2xl text-red-300" aria-label="Wrong">
                    &#10007;
                  </span>
                )}

                {/* Reveal: voter count */}
                {isReveal && answerStats && (
                  <span className="absolute top-2 right-3 text-xs text-white/50 font-mono">
                    {answerStats[idx].count} vote{answerStats[idx].count !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Locked answer banner */}
        {selectedAnswer !== null && phase === GamePhase.ROUND_ACTIVE && (
          <div className="text-center py-3">
            <span className="font-display text-lg text-neon-cyan animate-pulse">
              Answer locked! Waiting for other players...
            </span>
          </div>
        )}

        {/* Reveal: round results */}
        {isReveal && (
          <Card className="mt-2">
            <h3 className="font-display text-lg text-neon-yellow mb-3">Round Results</h3>
            <div className="flex flex-col gap-2">
              {players
                .slice()
                .sort((a, b) => (roundPoints[b.id] ?? 0) - (roundPoints[a.id] ?? 0))
                .map((player) => {
                  const answer = rd.playerAnswers[player.id];
                  const pts = roundPoints[player.id] ?? 0;
                  const gotRight = answer
                    ? answer.answerIndex === rd.correctIndex
                    : false;

                  return (
                    <div
                      key={player.id}
                      className={[
                        'flex items-center justify-between px-4 py-2 rounded-lg',
                        gotRight ? 'bg-green-500/10' : 'bg-red-500/10',
                        player.id === currentPlayerId ? 'ring-1 ring-neon-cyan/40' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-body ${
                            gotRight ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {gotRight ? '\u2713' : '\u2717'}
                        </span>
                        <span className="font-body text-sm text-white">
                          {player.name}
                          {player.id === currentPlayerId && (
                            <span className="text-white/40 ml-1">(You)</span>
                          )}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-sm font-bold ${
                          pts > 0 ? 'text-neon-yellow' : 'text-white/40'
                        }`}
                      >
                        +{pts}
                      </span>
                    </div>
                  );
                })}
            </div>
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
    </div>
  );
};

export default TriviaGame;
