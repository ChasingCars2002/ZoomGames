import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { useTransportContext } from '../../../context/TransportContext';
import { GamePhase, Player, GameMessage } from '../../../types';
import { calculateGuessPoints } from '../../../lib/engine/ScoreManager';
import { PICTIONARY_WORDS } from '../../../constants/words';
import { pickRandom } from '../../../lib/utils/shuffle';
import { sanitizeMessage } from '../../../lib/security/sanitize';
import DrawingCanvas, { DrawingCanvasHandle } from './DrawingCanvas';
import DrawingToolbar from './DrawingToolbar';
import WordHint from './WordHint';
import Timer from '../../ui/Timer';
import Scoreboard from '../../game/Scoreboard';

// ---------------------------------------------------------------------------
// Types for round data
// ---------------------------------------------------------------------------

interface GuesserEntry {
  playerId: string;
  guessedAt: number; // timestamp
  points: number;
  order: number; // 1-indexed
}

interface PictionaryRoundData {
  drawerId: string;
  word: string;
  wordLength: number;
  category: 'easy' | 'medium' | 'hard';
  correctGuessers: GuesserEntry[];
  /** Used words this game session to avoid repeats */
  usedWords?: string[];
}

interface ChatEntry {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  isCorrect?: boolean;
  isSystem?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlayerName(players: Player[], playerId: string): string {
  return players.find((p) => p.id === playerId)?.name ?? 'Unknown';
}

// ---------------------------------------------------------------------------
// PictionaryGame – Main orchestrator
// ---------------------------------------------------------------------------

const PictionaryGame: React.FC = () => {
  const { engineState, dispatch, playerAction } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();
  const { transport } = useTransportContext();

  const {
    phase,
    config,
    players,
    scores,
    currentRound,
    totalRounds,
    timeRemaining,
  } = engineState;

  const roundData = engineState.roundData as PictionaryRoundData | null;

  // Drawing refs
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  // Toolbar state
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(8);
  const [isEraser, setIsEraser] = useState(false);

  // Guess input state
  const [guessInput, setGuessInput] = useState('');

  // Chat messages for the guessing panel
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Track which round we last started to avoid duplicate dispatches
  const lastStartedRound = useRef(0);

  // Track used words across rounds in this game session
  const usedWordsRef = useRef<string[]>([]);

  // Track if we already ended this round (to avoid duplicate END_ROUND)
  const roundEndedRef = useRef(false);

  // Round-end display timer
  const [showRoundEnd, setShowRoundEnd] = useState(false);

  // Derived values
  const drawerId = roundData?.drawerId ?? null;
  const isDrawer = currentPlayerId === drawerId;
  const word = roundData?.word ?? '';
  const correctGuessers = roundData?.correctGuessers ?? [];
  const hasGuessedCorrectly = correctGuessers.some(
    (g) => g.playerId === currentPlayerId,
  );

  // Get total time from config
  const totalTime = config.timeLimit;

  // -----------------------------------------------------------------------
  // GAME_STARTING: Host picks drawer and word, dispatches START_ROUND
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.GAME_STARTING && phase !== GamePhase.ROUND_ENDING) return;

    // Don't re-start if we've already started this round
    const nextRound = currentRound + (phase === GamePhase.GAME_STARTING ? 1 : 1);
    if (lastStartedRound.current >= nextRound) return;
    if (nextRound > totalRounds) return;

    // For ROUND_ENDING, wait a bit before starting next round
    const delay = phase === GamePhase.ROUND_ENDING ? 5000 : 1500;

    const timer = setTimeout(() => {
      if (lastStartedRound.current >= nextRound) return;
      lastStartedRound.current = nextRound;

      // Pick drawer using round-robin from connected players
      const connectedPlayers = players.filter((p) => p.connected);
      if (connectedPlayers.length < 2) return;

      const drawerIndex = (nextRound - 1) % connectedPlayers.length;
      const drawer = connectedPlayers[drawerIndex];

      // Pick word based on difficulty, avoiding repeats
      const difficulty = config.difficulty as 'easy' | 'medium' | 'hard';
      const wordPool = PICTIONARY_WORDS[difficulty].filter(
        (w) => !usedWordsRef.current.includes(w),
      );

      // If we've used all words, reset the pool
      const finalPool =
        wordPool.length > 0 ? wordPool : PICTIONARY_WORDS[difficulty];
      const chosenWord = pickRandom(finalPool);
      usedWordsRef.current = [...usedWordsRef.current, chosenWord];

      const newRoundData: PictionaryRoundData = {
        drawerId: drawer.id,
        word: chosenWord,
        wordLength: chosenWord.length,
        category: difficulty,
        correctGuessers: [],
        usedWords: usedWordsRef.current,
      };

      roundEndedRef.current = false;

      // Dispatch START_ROUND
      dispatch({ type: 'START_ROUND', roundData: newRoundData });

      // Broadcast to non-host players
      transport?.send({
        type: 'ROUND_START',
        payload: {
          round: nextRound,
          data: newRoundData,
        },
      });

      // Clear chat for new round
      setChatMessages([
        {
          playerId: 'system',
          playerName: 'System',
          text: `Round ${nextRound}! ${getPlayerName(players, drawer.id)} is drawing.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
    }, delay);

    return () => clearTimeout(timer);
  }, [
    isHost,
    phase,
    currentRound,
    totalRounds,
    players,
    config.difficulty,
    dispatch,
    transport,
  ]);

  // -----------------------------------------------------------------------
  // Host: Listen for player guess actions
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ACTIVE || !roundData) return;

    // Watch for PLAYER_ACTION in the engine state's roundData.actions
    const rd = engineState.roundData as Record<string, unknown> | null;
    if (!rd) return;

    const actions = Array.isArray(rd.actions) ? rd.actions : [];

    // Process new guess actions
    for (const actionEntry of actions) {
      const entry = actionEntry as {
        playerId: string;
        action: { type: string; guess?: string };
        timestamp: number;
      };

      if (entry.action.type !== 'guess' || !entry.action.guess) continue;

      const guesserId = entry.playerId;
      const guessText = entry.action.guess.toLowerCase().trim();

      // Check if this player already guessed correctly
      const currentRd = engineState.roundData as PictionaryRoundData;
      if (currentRd.correctGuessers.some((g) => g.playerId === guesserId)) continue;

      // Don't allow the drawer to guess
      if (guesserId === currentRd.drawerId) continue;

      // Check correctness
      if (guessText === currentRd.word.toLowerCase()) {
        const guessOrder = currentRd.correctGuessers.length + 1;
        const points = calculateGuessPoints(
          timeRemaining,
          totalTime,
          guessOrder,
        );

        const newGuesser: GuesserEntry = {
          playerId: guesserId,
          guessedAt: Date.now(),
          points,
          order: guessOrder,
        };

        const updatedCorrectGuessers = [
          ...currentRd.correctGuessers,
          newGuesser,
        ];

        const updatedRoundData: PictionaryRoundData = {
          ...currentRd,
          correctGuessers: updatedCorrectGuessers,
        };

        // Update roundData via a new START_ROUND-like mechanism
        // We dispatch END_ROUND to update scores, but we need to keep round active.
        // Instead, we update roundData manually and broadcast.
        // Use a workaround: dispatch PLAYER_ACTION results via GAME_STATE_SYNC
        // Actually, the best approach is to update roundData via dispatch.
        // The engine supports updating roundData through END_ROUND, but that changes phase.
        // So we broadcast the updated roundData via transport as a GAME_STATE_SYNC.

        // Directly mutate engineState.roundData is not ideal but engine syncs it
        // Instead, let's just broadcast the update and track locally
        dispatch({
          type: 'START_ROUND',
          roundData: updatedRoundData,
        });

        // Hmm, START_ROUND won't work in ROUND_ACTIVE phase.
        // Let's use the approach of syncing via transport directly.
        // The GAME_STATE_SYNC will propagate the updated roundData.

        // Actually, let's just keep a local ref for correctGuessers and
        // include it in the END_ROUND dispatch.
      }
    }
  }, [
    isHost,
    phase,
    engineState.roundData,
    timeRemaining,
    totalTime,
  ]);

  // -----------------------------------------------------------------------
  // Better approach: Host processes guesses via transport messages directly
  // -----------------------------------------------------------------------
  const correctGuessersRef = useRef<GuesserEntry[]>([]);

  // Reset when round changes
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) {
      correctGuessersRef.current = [];
      setChatMessages((prev) => {
        if (prev.length > 0 && prev[0].isSystem) return prev;
        return [
          {
            playerId: 'system',
            playerName: 'System',
            text: `${getPlayerName(players, drawerId ?? '')} is drawing!`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ];
      });
    }
  }, [phase, drawerId, players]);

  // Host subscribes to transport for PLAYER_ACTION guess messages
  useEffect(() => {
    if (!transport || !isHost) return;

    const unsubscribe = transport.subscribe(
      (message: GameMessage, _senderId: string) => {
        if (message.type !== 'PLAYER_ACTION') return;

        const { playerId, action } = message.payload;
        if (action.type !== 'guess' || !action.guess) return;

        handleGuess(playerId, action.guess);
      },
    );

    return unsubscribe;
  }, [transport, isHost, phase]);

  // Host handles local guesses too (when host is a guesser)
  const handleGuess = useCallback(
    (guesserId: string, guessText: string) => {
      if (phase !== GamePhase.ROUND_ACTIVE || !roundData) return;

      const currentWord = roundData.word;
      const currentDrawerId = roundData.drawerId;

      // Drawer cannot guess
      if (guesserId === currentDrawerId) return;

      // Already guessed correctly
      if (correctGuessersRef.current.some((g) => g.playerId === guesserId)) return;

      const normalizedGuess = guessText.toLowerCase().trim();
      const guesserName = getPlayerName(players, guesserId);

      if (normalizedGuess === currentWord.toLowerCase()) {
        // Correct guess!
        const guessOrder = correctGuessersRef.current.length + 1;
        const points = calculateGuessPoints(
          timeRemaining,
          totalTime,
          guessOrder,
        );

        const newGuesser: GuesserEntry = {
          playerId: guesserId,
          guessedAt: Date.now(),
          points,
          order: guessOrder,
        };

        correctGuessersRef.current = [
          ...correctGuessersRef.current,
          newGuesser,
        ];

        // Add correct guess message to chat
        const correctMsg: ChatEntry = {
          playerId: guesserId,
          playerName: guesserName,
          text: `guessed correctly! (+${points} pts)`,
          timestamp: Date.now(),
          isCorrect: true,
        };

        setChatMessages((prev) => [...prev, correctMsg]);

        // Broadcast updated round data with correct guessers
        if (isHost && transport) {
          const updatedRoundData: PictionaryRoundData = {
            ...roundData,
            correctGuessers: correctGuessersRef.current,
          };

          transport.send({
            type: 'GAME_STATE_SYNC',
            payload: {
              phase: engineState.phase,
              gameType: engineState.gameType,
              config: engineState.config,
              scores: engineState.scores,
              currentRound: engineState.currentRound,
              totalRounds: engineState.totalRounds,
              roundData: updatedRoundData,
              hostId: engineState.hostId,
              timeRemaining: engineState.timeRemaining,
              players: engineState.players,
            },
          });
        }

        // Check if all guessers got it right
        const totalGuessers = players.filter(
          (p) => p.id !== currentDrawerId && p.connected,
        ).length;

        if (correctGuessersRef.current.length >= totalGuessers) {
          // End round early - all guessers correct
          endCurrentRound();
        }
      } else {
        // Wrong guess - show in chat (but mask if close to the word)
        const isClose =
          normalizedGuess.length > 2 &&
          currentWord.toLowerCase().includes(normalizedGuess);

        const chatMsg: ChatEntry = {
          playerId: guesserId,
          playerName: guesserName,
          text: isClose ? '***' : guessText,
          timestamp: Date.now(),
          isCorrect: false,
        };

        setChatMessages((prev) => [...prev, chatMsg]);

        // Broadcast the chat message to other players
        if (transport) {
          transport.send({
            type: 'CHAT_MESSAGE',
            payload: {
              playerId: guesserId,
              text: isClose ? '***' : guessText,
              timestamp: Date.now(),
            },
          });
        }
      }
    },
    [
      phase,
      roundData,
      players,
      timeRemaining,
      totalTime,
      isHost,
      transport,
      engineState,
    ],
  );

  // -----------------------------------------------------------------------
  // Non-host: Listen for chat messages from transport
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!transport || isHost) return;

    const unsubscribe = transport.subscribe(
      (message: GameMessage, _senderId: string) => {
        if (message.type === 'CHAT_MESSAGE') {
          const { playerId, text, timestamp } = message.payload;
          const playerName = getPlayerName(players, playerId);

          setChatMessages((prev) => [
            ...prev,
            {
              playerId,
              playerName,
              text,
              timestamp,
              isCorrect: false,
            },
          ]);
        }
      },
    );

    return unsubscribe;
  }, [transport, isHost, players]);

  // -----------------------------------------------------------------------
  // End round logic
  // -----------------------------------------------------------------------
  const endCurrentRound = useCallback(() => {
    if (!isHost || roundEndedRef.current || !roundData) return;

    roundEndedRef.current = true;

    // Calculate scores: guessers get their calculated points,
    // drawer gets 100 per correct guesser
    const roundScores: Record<string, number> = {};
    const guessers = correctGuessersRef.current;

    for (const g of guessers) {
      roundScores[g.playerId] = g.points;
    }

    // Drawer bonus: 100 points per correct guesser
    const drawerPoints = guessers.length * 100;
    if (roundData.drawerId && drawerPoints > 0) {
      roundScores[roundData.drawerId] = drawerPoints;
    }

    const finalRoundData: PictionaryRoundData = {
      ...roundData,
      correctGuessers: guessers,
    };

    // Dispatch END_ROUND
    dispatch({
      type: 'END_ROUND',
      scores: roundScores,
      roundData: finalRoundData,
    });

    // Broadcast to non-host
    transport?.send({
      type: 'ROUND_END',
      payload: {
        scores: roundScores,
        roundData: finalRoundData,
      },
    });
  }, [isHost, roundData, dispatch, transport]);

  // -----------------------------------------------------------------------
  // Host: Timer expired -> end round
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING) return;

    // Phase changed to ROUND_ENDING (via TICK expiring)
    // End the round if not already ended
    if (!roundEndedRef.current) {
      endCurrentRound();
    }
  }, [isHost, phase, endCurrentRound]);

  // Host: also check if time hits 0 during ROUND_ACTIVE
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ACTIVE) return;
    if (timeRemaining <= 0 && !roundEndedRef.current) {
      endCurrentRound();
    }
  }, [isHost, phase, timeRemaining, endCurrentRound]);

  // -----------------------------------------------------------------------
  // Show round end results for a bit then transition
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (
      phase === GamePhase.ROUND_ENDING ||
      phase === GamePhase.GAME_ENDING
    ) {
      setShowRoundEnd(true);
    } else {
      setShowRoundEnd(false);
    }
  }, [phase]);

  // -----------------------------------------------------------------------
  // Host: Game ending -> dispatch END_GAME after delay
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost || phase !== GamePhase.GAME_ENDING) return;

    const timer = setTimeout(() => {
      dispatch({ type: 'END_GAME' });
      transport?.send({
        type: 'GAME_END',
        payload: { finalScores: engineState.scores },
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [isHost, phase, dispatch, transport, engineState.scores]);

  // -----------------------------------------------------------------------
  // Auto-scroll chat
  // -----------------------------------------------------------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // -----------------------------------------------------------------------
  // Submit guess handler
  // -----------------------------------------------------------------------
  const handleGuessSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const sanitized = sanitizeMessage(guessInput);
      if (!sanitized || !currentPlayerId) return;

      // Send guess via playerAction
      playerAction({ type: 'guess', guess: sanitized });

      // If host, also handle locally
      if (isHost) {
        handleGuess(currentPlayerId, sanitized);
      } else {
        // Add to local chat immediately for non-host
        setChatMessages((prev) => [
          ...prev,
          {
            playerId: currentPlayerId,
            playerName: getPlayerName(players, currentPlayerId),
            text: sanitized,
            timestamp: Date.now(),
          },
        ]);
      }

      setGuessInput('');
    },
    [guessInput, currentPlayerId, playerAction, isHost, handleGuess, players],
  );

  // -----------------------------------------------------------------------
  // Toolbar handlers
  // -----------------------------------------------------------------------
  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
  }, []);

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const handleToggleEraser = useCallback(() => {
    setIsEraser((prev) => !prev);
  }, []);

  // -----------------------------------------------------------------------
  // Derived: drawer player info
  // -----------------------------------------------------------------------
  const drawerPlayer = useMemo(
    () => players.find((p) => p.id === drawerId),
    [players, drawerId],
  );

  // -----------------------------------------------------------------------
  // Render: Waiting / Starting
  // -----------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING && !roundData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/60">
            Starting Pictionary...
          </p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Round Ending / Game Ending overlay
  // -----------------------------------------------------------------------
  const renderRoundEndOverlay = () => {
    if (!showRoundEnd || !roundData) return null;

    const guessers = roundData.correctGuessers ?? [];
    const drawerPts = guessers.length * 100;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm animate-fade-in">
        <div className="bg-navy-800 rounded-2xl border border-white/10 p-8 max-w-md w-full mx-4 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl text-neon-yellow mb-2">
              {phase === GamePhase.GAME_ENDING
                ? 'Game Over!'
                : `Round ${currentRound} Complete`}
            </h2>
            <p className="font-body text-white/50">The word was:</p>
            <p className="font-display text-3xl text-neon-green mt-1">
              {roundData.word}
            </p>
          </div>

          {/* Results */}
          <div className="space-y-3 mb-6">
            {/* Drawer */}
            {drawerPlayer && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-neon-yellow/10 rounded-xl border border-neon-yellow/20">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f5e642"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m2 13 4.5-3.5L10 12l3-4 4 3 4.5-3.5L2 13Z" />
                    <path d="M2 13v6h20v-6" />
                  </svg>
                  <span className="font-display text-sm text-neon-yellow">
                    {drawerPlayer.name}
                  </span>
                  <span className="font-body text-xs text-white/40">(drawer)</span>
                </div>
                <span className="font-mono text-sm text-neon-yellow">
                  +{drawerPts}
                </span>
              </div>
            )}

            {/* Guessers */}
            {guessers.length > 0 ? (
              guessers
                .sort((a, b) => a.order - b.order)
                .map((g) => (
                  <div
                    key={g.playerId}
                    className="flex items-center justify-between px-4 py-2.5 bg-neon-green/10 rounded-xl border border-neon-green/20"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/40 w-5">
                        #{g.order}
                      </span>
                      <span className="font-display text-sm text-neon-green">
                        {getPlayerName(players, g.playerId)}
                      </span>
                    </div>
                    <span className="font-mono text-sm text-neon-green">
                      +{g.points}
                    </span>
                  </div>
                ))
            ) : (
              <div className="text-center py-4 text-white/30 font-body text-sm">
                Nobody guessed the word!
              </div>
            )}
          </div>

          {/* Next round indicator */}
          {phase === GamePhase.ROUND_ENDING && currentRound < totalRounds && (
            <div className="text-center">
              <p className="font-body text-sm text-white/40">
                Next round starting soon...
              </p>
              <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neon-cyan rounded-full"
                  style={{
                    animation: 'fillBar 5s linear forwards',
                  }}
                />
              </div>
            </div>
          )}

          {phase === GamePhase.GAME_ENDING && (
            <div className="text-center">
              <p className="font-body text-sm text-white/40">
                Showing final results...
              </p>
            </div>
          )}
        </div>

        <style>{`
          @keyframes fillBar {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Render: Active round
  // -----------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full gap-4 p-2 md:p-4">
      {/* Round end overlay */}
      {renderRoundEndOverlay()}

      {/* ===== Top Bar: Round info, Timer, Word/Hint ===== */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Round info */}
        <div className="flex items-center gap-3">
          <span className="font-display text-sm text-white/40 uppercase tracking-wider">
            Round {currentRound}/{totalRounds}
          </span>
          <div className="w-px h-5 bg-white/10" />
          <span className="font-body text-sm text-white/60">
            Difficulty:{' '}
            <span
              className={
                config.difficulty === 'easy'
                  ? 'text-neon-green'
                  : config.difficulty === 'hard'
                    ? 'text-neon-pink'
                    : 'text-neon-yellow'
              }
            >
              {config.difficulty}
            </span>
          </span>
        </div>

        {/* Timer */}
        {phase === GamePhase.ROUND_ACTIVE && (
          <Timer
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            size="md"
          />
        )}

        {/* Drawer info */}
        {drawerPlayer && (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: drawerPlayer.color }}
            />
            <span className="font-display text-sm text-white/60">
              {isDrawer ? 'You are drawing!' : `${drawerPlayer.name} is drawing`}
            </span>
          </div>
        )}
      </div>

      {/* ===== Secret word display (drawer only) ===== */}
      {isDrawer && phase === GamePhase.ROUND_ACTIVE && (
        <div className="flex items-center justify-center py-2 px-4 bg-neon-yellow/10 rounded-xl border border-neon-yellow/20">
          <span className="font-body text-sm text-white/50 mr-2">Your word:</span>
          <span className="font-display text-2xl text-neon-yellow uppercase tracking-wider">
            {word}
          </span>
        </div>
      )}

      {/* ===== Word hint display (guesser only) ===== */}
      {!isDrawer && phase === GamePhase.ROUND_ACTIVE && (
        <div className="flex justify-center py-2">
          <WordHint
            word={word}
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            revealed={false}
          />
        </div>
      )}

      {/* ===== Main content: Canvas + Sidebar ===== */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left: Canvas area */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Canvas */}
          <div className="flex-1 min-h-[300px]">
            <DrawingCanvas
              ref={canvasRef}
              isDrawer={isDrawer && phase === GamePhase.ROUND_ACTIVE}
              color={currentColor}
              brushSize={currentSize}
              isEraser={isEraser}
            />
          </div>

          {/* Toolbar (drawer only) */}
          {isDrawer && phase === GamePhase.ROUND_ACTIVE && (
            <DrawingToolbar
              currentColor={currentColor}
              onColorChange={setCurrentColor}
              currentSize={currentSize}
              onSizeChange={setCurrentSize}
              onClear={handleClear}
              onUndo={handleUndo}
              isEraser={isEraser}
              onToggleEraser={handleToggleEraser}
            />
          )}
        </div>

        {/* Right: Sidebar (Chat/Guesses + Scoreboard) */}
        <div className="w-72 lg:w-80 flex flex-col gap-4 shrink-0 hidden md:flex">
          {/* Chat / Guess Panel */}
          <div className="flex-1 flex flex-col bg-navy-800/30 rounded-xl border border-white/5 overflow-hidden min-h-0">
            {/* Chat header */}
            <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
              <h3 className="font-display text-sm text-white/60 uppercase tracking-wider">
                {isDrawer ? 'Guesses' : 'Guess the Word'}
              </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
              {chatMessages.length === 0 && (
                <p className="text-center text-white/20 font-body text-sm py-8">
                  {isDrawer
                    ? 'Waiting for guesses...'
                    : 'Type your guess below!'}
                </p>
              )}
              {chatMessages.map((msg, index) => (
                <div
                  key={`${msg.playerId}-${msg.timestamp}-${index}`}
                  className={[
                    'animate-fade-in',
                    msg.isCorrect
                      ? 'bg-neon-green/10 rounded-lg px-2 py-1 -mx-2'
                      : '',
                    msg.isSystem
                      ? 'bg-neon-cyan/5 rounded-lg px-2 py-1 -mx-2'
                      : '',
                  ].join(' ')}
                >
                  {msg.isSystem ? (
                    <p className="font-body text-xs text-neon-cyan/60 italic">
                      {msg.text}
                    </p>
                  ) : (
                    <>
                      <span className="font-display text-xs text-neon-cyan">
                        {msg.playerName}
                      </span>
                      <p
                        className={[
                          'font-body text-sm',
                          msg.isCorrect
                            ? 'text-neon-green font-semibold'
                            : 'text-white/80',
                        ].join(' ')}
                      >
                        {msg.isCorrect && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#39ff14"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="inline mr-1 -mt-0.5"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {msg.text}
                      </p>
                    </>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Guess input (guessers only, during active round) */}
            {!isDrawer && phase === GamePhase.ROUND_ACTIVE && (
              <form
                onSubmit={handleGuessSubmit}
                className="px-3 py-2.5 border-t border-white/5 shrink-0"
              >
                <div className="flex items-center gap-2">
                  {hasGuessedCorrectly ? (
                    <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-neon-green/10 border border-neon-green/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#39ff14"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="font-display text-sm text-neon-green">
                        Correct!
                      </span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={guessInput}
                        onChange={(e) => setGuessInput(e.target.value)}
                        placeholder="Type your guess..."
                        maxLength={100}
                        className={[
                          'flex-1 font-body text-sm text-white bg-navy-700 rounded-lg px-3 py-2',
                          'placeholder:text-white/25 border border-white/10',
                          'focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/30',
                          'transition-all duration-200',
                        ].join(' ')}
                        autoComplete="off"
                      />
                      <button
                        type="submit"
                        disabled={!guessInput.trim()}
                        className={[
                          'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                          'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30',
                          'hover:bg-neon-cyan/30 hover:border-neon-cyan/50',
                          'disabled:opacity-30 disabled:cursor-not-allowed',
                          'transition-all duration-200',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
                        ].join(' ')}
                        aria-label="Submit guess"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="none"
                        >
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Scoreboard */}
          <div className="bg-navy-800/30 rounded-xl border border-white/5 p-4">
            <Scoreboard
              scores={scores}
              players={players}
              currentPlayerId={currentPlayerId ?? ''}
            />
          </div>
        </div>
      </div>

      {/* ===== Mobile: Bottom guess input ===== */}
      {!isDrawer && phase === GamePhase.ROUND_ACTIVE && (
        <div className="md:hidden">
          <form onSubmit={handleGuessSubmit} className="flex items-center gap-2">
            {hasGuessedCorrectly ? (
              <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-neon-green/10 border border-neon-green/20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#39ff14"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="font-display text-sm text-neon-green">
                  Correct!
                </span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="Type your guess..."
                  maxLength={100}
                  className={[
                    'flex-1 font-body text-sm text-white bg-navy-700 rounded-xl px-4 py-3',
                    'placeholder:text-white/25 border border-white/10',
                    'focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/30',
                    'transition-all duration-200',
                  ].join(' ')}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!guessInput.trim()}
                  className={[
                    'shrink-0 px-5 py-3 rounded-xl font-display text-sm',
                    'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30',
                    'hover:bg-neon-cyan/30 hover:border-neon-cyan/50',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'transition-all duration-200',
                  ].join(' ')}
                >
                  Guess
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default PictionaryGame;
