import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase, Player } from '../../../types';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { useTransportContext } from '../../../context/TransportContext';
import { shuffle, pickRandom } from '../../../lib/utils/shuffle';
import { sanitizeMessage } from '../../../lib/security/sanitize';
import { calculateGuessPoints } from '../../../lib/engine/ScoreManager';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Timer from '../../ui/Timer';
import Avatar from '../../ui/Avatar';
import Badge from '../../ui/Badge';
import Scoreboard from '../../game/Scoreboard';
import ChatPanel from '../../game/ChatPanel';
import RoundTransition from '../../game/RoundTransition';

// ---------------------------------------------------------------------------
// Built-in Charades prompts
// ---------------------------------------------------------------------------

const CHARADES_PROMPTS: Record<string, string[]> = {
  Movies: [
    'The Lion King',
    'Star Wars',
    'Titanic',
    'Jurassic Park',
    'Harry Potter',
    'Finding Nemo',
    'The Matrix',
    'Frozen',
    'Batman',
    'Spider-Man',
    'Toy Story',
    'Avatar',
    'Shrek',
  ],
  'Famous People': [
    'Albert Einstein',
    'Michael Jackson',
    'Beyonce',
    'Elon Musk',
    'Taylor Swift',
    'Cristiano Ronaldo',
    'Oprah Winfrey',
    'Michael Jordan',
  ],
  Animals: [
    'Elephant',
    'Penguin',
    'Kangaroo',
    'Giraffe',
    'Monkey',
    'Snake',
    'Dolphin',
    'Eagle',
    'Bear',
    'Butterfly',
  ],
  Actions: [
    'Swimming',
    'Playing Guitar',
    'Cooking',
    'Dancing',
    'Taking a Selfie',
    'Surfing',
    'Playing Tennis',
    'Riding a Horse',
    'Skateboarding',
    'Yoga',
  ],
  Brands: [
    'Apple',
    'Nike',
    "McDonald's",
    'Disney',
    'Netflix',
    'Amazon',
    'Coca-Cola',
    'Google',
    'LEGO',
    'Starbucks',
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuessEntry {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  isCorrect: boolean;
}

interface CharadesRoundData {
  performerId: string;
  prompt: string;
  category: string;
  keywords: string[];
  correctGuesserId: string | null;
  guesses: GuessEntry[];
  passCount: number;
  maxPasses: number;
  actions?: Array<{
    playerId: string;
    action: { type: string; [key: string]: unknown };
    timestamp: number;
  }>;
}

interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  isCorrect?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlayerName(players: Player[], playerId: string): string {
  return players.find((p) => p.id === playerId)?.name ?? 'Unknown';
}

function getPlayer(players: Player[], playerId: string): Player | undefined {
  return players.find((p) => p.id === playerId);
}

/**
 * Extract keywords from a prompt for matching purposes.
 * Splits by spaces, filters words > 2 chars, lowercases.
 */
function extractKeywords(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length > 0);
}

/**
 * Check if a guess matches the prompt.
 * Returns 'exact' for exact match, 'correct' for >= 50% keyword match,
 * 'close' for partial keyword match (at least 1), or 'wrong'.
 */
function checkGuess(
  guess: string,
  prompt: string,
  keywords: string[],
): 'exact' | 'correct' | 'close' | 'wrong' {
  const normalizedGuess = guess.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const normalizedPrompt = prompt.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');

  // Exact match
  if (normalizedGuess === normalizedPrompt) return 'exact';

  // Check if guess contains the full prompt
  if (normalizedGuess.includes(normalizedPrompt)) return 'exact';
  if (normalizedPrompt.includes(normalizedGuess) && normalizedGuess.length >= normalizedPrompt.length * 0.7) {
    return 'correct';
  }

  // Keyword matching
  if (keywords.length === 0) return 'wrong';

  const guessWords = normalizedGuess.split(/\s+/);
  let matchedCount = 0;

  for (const keyword of keywords) {
    for (const gw of guessWords) {
      if (gw === keyword || gw.includes(keyword) || keyword.includes(gw)) {
        matchedCount++;
        break;
      }
    }
  }

  const matchRatio = matchedCount / keywords.length;

  if (matchRatio >= 0.5) return 'correct';
  if (matchedCount >= 1) return 'close';
  return 'wrong';
}

/**
 * Pick a random prompt from a random category, avoiding used prompts.
 */
function pickPrompt(usedPrompts: Set<string>): { prompt: string; category: string } {
  const categories = Object.keys(CHARADES_PROMPTS);
  const shuffledCategories = shuffle(categories);

  for (const cat of shuffledCategories) {
    const available = CHARADES_PROMPTS[cat].filter((p) => !usedPrompts.has(p));
    if (available.length > 0) {
      const prompt = pickRandom(available);
      return { prompt, category: cat };
    }
  }

  // All used - reset and pick from any
  const cat = pickRandom(categories);
  const prompt = pickRandom(CHARADES_PROMPTS[cat]);
  return { prompt, category: cat };
}

// ---------------------------------------------------------------------------
// Category badge colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Movies: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  'Famous People': 'bg-purple-500/20 text-purple-300 border-purple-400/30',
  Animals: 'bg-green-500/20 text-green-300 border-green-400/30',
  Actions: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
  Brands: 'bg-red-500/20 text-red-300 border-red-400/30',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CharadesGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();
  const { transport } = useTransportContext();

  const {
    phase,
    players,
    scores,
    currentRound,
    totalRounds,
    roundData,
    config,
    timeRemaining,
  } = engineState;

  const totalTime = config.timeLimit || 90;
  const rd = roundData as CharadesRoundData | null;

  // Chat messages for guessing
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Round transition
  const [showTransition, setShowTransition] = useState(false);

  // Show round-end summary
  const [showRoundEnd, setShowRoundEnd] = useState(false);

  // Track processed actions
  const processedActionsRef = useRef<number>(0);

  // Track used prompts across rounds
  const usedPromptsRef = useRef<Set<string>>(new Set());

  // Track whether we already ended this round
  const roundEndedRef = useRef(false);

  // Track which round we started
  const lastStartedRoundRef = useRef(0);

  // "Close!" hint cooldown
  const [closeHint, setCloseHint] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // GAME_STARTING: Host picks performer and prompt, dispatches START_ROUND
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.GAME_STARTING) return;

    const connectedPlayers = players.filter((p) => p.connected);
    if (connectedPlayers.length < 2) return;

    const timer = setTimeout(() => {
      if (lastStartedRoundRef.current >= 1) return;
      lastStartedRoundRef.current = 1;

      const performerIndex = 0;
      const performer = connectedPlayers[performerIndex];

      const { prompt, category } = pickPrompt(usedPromptsRef.current);
      usedPromptsRef.current.add(prompt);

      const keywords = extractKeywords(prompt);

      const newRoundData: CharadesRoundData = {
        performerId: performer.id,
        prompt,
        category,
        keywords,
        correctGuesserId: null,
        guesses: [],
        passCount: 0,
        maxPasses: 2,
      };

      roundEndedRef.current = false;

      dispatch({ type: 'START_ROUND', roundData: newRoundData });

      transport?.send({
        type: 'ROUND_START',
        payload: { round: 1, data: newRoundData },
      });

      setChatMessages([
        {
          playerId: 'system',
          playerName: 'System',
          text: `Round 1! ${performer.name} is performing. Category: ${category}`,
          timestamp: Date.now(),
          isCorrect: false,
        },
      ]);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isHost, phase, players, dispatch, transport]);

  // ---------------------------------------------------------------------------
  // Reset local state when round changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) {
      processedActionsRef.current = 0;
      setShowRoundEnd(false);
      setCloseHint(null);
      roundEndedRef.current = false;
    }
  }, [phase, currentRound]);

  // ---------------------------------------------------------------------------
  // Host: process incoming actions
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!rd || !rd.actions) return;
    if (rd.correctGuesserId) return; // Already guessed correctly

    const actions = rd.actions;
    const startIdx = processedActionsRef.current;
    if (actions.length <= startIdx) return;

    let updatedGuesses = [...rd.guesses];
    let correctGuesserId: string | null = rd.correctGuesserId;
    let updatedPassCount = rd.passCount;
    let updatedPrompt = rd.prompt;
    let updatedCategory = rd.category;
    let updatedKeywords = [...rd.keywords];
    let needsBroadcast = false;

    for (let i = startIdx; i < actions.length; i++) {
      const entry = actions[i];
      const { playerId, action } = entry;

      // Handle guess from non-performer
      if (
        action.type === 'guess' &&
        playerId !== rd.performerId &&
        !correctGuesserId
      ) {
        const guessText = sanitizeMessage(String(action.guess ?? ''));
        if (!guessText) continue;

        const playerName = getPlayerName(players, playerId);
        const matchResult = checkGuess(guessText, updatedPrompt, updatedKeywords);

        const isCorrect = matchResult === 'exact' || matchResult === 'correct';

        const guessEntry: GuessEntry = {
          playerId,
          playerName,
          text: guessText,
          timestamp: entry.timestamp,
          isCorrect,
        };

        updatedGuesses = [...updatedGuesses, guessEntry];

        // Add to chat
        setChatMessages((prev) => [
          ...prev,
          {
            playerId,
            playerName,
            text: guessText,
            timestamp: entry.timestamp,
            isCorrect,
          },
        ]);

        if (isCorrect) {
          correctGuesserId = playerId;
          needsBroadcast = true;

          // Add system message
          setChatMessages((prev) => [
            ...prev,
            {
              playerId: 'system',
              playerName: 'System',
              text: `${playerName} guessed correctly!`,
              timestamp: Date.now(),
              isCorrect: true,
            },
          ]);
        } else if (matchResult === 'close') {
          // Show "Close!" hint
          setChatMessages((prev) => [
            ...prev,
            {
              playerId: 'system',
              playerName: 'System',
              text: `${playerName} is close!`,
              timestamp: Date.now(),
            },
          ]);
        }
      }

      // Handle pass from performer
      if (
        action.type === 'pass' &&
        playerId === rd.performerId &&
        !correctGuesserId &&
        updatedPassCount < rd.maxPasses
      ) {
        updatedPassCount++;

        // Pick a new prompt
        const { prompt: newPrompt, category: newCategory } = pickPrompt(usedPromptsRef.current);
        usedPromptsRef.current.add(newPrompt);
        updatedPrompt = newPrompt;
        updatedCategory = newCategory;
        updatedKeywords = extractKeywords(newPrompt);
        needsBroadcast = true;

        setChatMessages((prev) => [
          ...prev,
          {
            playerId: 'system',
            playerName: 'System',
            text: `Performer passed! New prompt. Category: ${newCategory} (${rd.maxPasses - updatedPassCount} passes left)`,
            timestamp: Date.now(),
          },
        ]);
      }

      // Handle manual confirm from host/performer
      if (
        action.type === 'confirm_guess' &&
        (playerId === rd.performerId || playerId === engineState.hostId) &&
        !correctGuesserId
      ) {
        const confirmedPlayerId = action.playerId as string;
        correctGuesserId = confirmedPlayerId;
        needsBroadcast = true;

        // Mark the guess as correct in the guesses array
        updatedGuesses = updatedGuesses.map((g) =>
          g.playerId === confirmedPlayerId && !g.isCorrect
            ? { ...g, isCorrect: true }
            : g,
        );

        const confirmedName = getPlayerName(players, confirmedPlayerId);
        setChatMessages((prev) => [
          ...prev,
          {
            playerId: 'system',
            playerName: 'System',
            text: `${confirmedName}'s guess was confirmed correct!`,
            timestamp: Date.now(),
            isCorrect: true,
          },
        ]);
      }
    }

    processedActionsRef.current = actions.length;

    // If someone guessed correctly, end the round
    if (correctGuesserId && !roundEndedRef.current) {
      roundEndedRef.current = true;

      const roundScores: Record<string, number> = {};
      for (const p of players) {
        roundScores[p.id] = 0;
      }

      // Speed bonus for guesser
      const guessPoints = calculateGuessPoints(timeRemaining, totalTime, 1);
      roundScores[correctGuesserId] = guessPoints;

      // Performer gets 300 points
      roundScores[rd.performerId] = 300;

      // Penalty for passes
      if (updatedPassCount > 0) {
        roundScores[rd.performerId] = Math.max(
          0,
          roundScores[rd.performerId] - updatedPassCount * 100,
        );
      }

      const updatedRd: CharadesRoundData = {
        ...rd,
        prompt: updatedPrompt,
        category: updatedCategory,
        keywords: updatedKeywords,
        guesses: updatedGuesses,
        correctGuesserId,
        passCount: updatedPassCount,
      };

      dispatch({
        type: 'END_ROUND',
        scores: roundScores,
        roundData: updatedRd,
      });

      transport?.send({
        type: 'ROUND_END',
        payload: { scores: roundScores, roundData: updatedRd },
      });
    } else if (needsBroadcast && !correctGuesserId) {
      // Broadcast updated round data (new prompt from pass, etc.)
      const updatedRd: CharadesRoundData = {
        ...rd,
        prompt: updatedPrompt,
        category: updatedCategory,
        keywords: updatedKeywords,
        guesses: updatedGuesses,
        correctGuesserId: null,
        passCount: updatedPassCount,
      };

      transport?.send({
        type: 'GAME_STATE_SYNC',
        payload: {
          phase: engineState.phase,
          gameType: engineState.gameType,
          config: engineState.config,
          scores: engineState.scores,
          currentRound: engineState.currentRound,
          totalRounds: engineState.totalRounds,
          roundData: updatedRd,
          hostId: engineState.hostId,
          timeRemaining: engineState.timeRemaining,
          players: engineState.players,
        },
      });
    }
  }, [isHost, phase, rd?.actions?.length, rd?.correctGuesserId, players, timeRemaining, totalTime, dispatch, transport, engineState]);

  // ---------------------------------------------------------------------------
  // Non-host: process actions for chat display
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isHost) return;
    if (!rd || !rd.actions) return;

    const actions = rd.actions;
    const startIdx = processedActionsRef.current;
    if (actions.length <= startIdx) return;

    for (let i = startIdx; i < actions.length; i++) {
      const entry = actions[i];
      const { playerId, action } = entry;

      if (action.type === 'guess' && playerId !== rd.performerId) {
        const guessText = String(action.guess ?? '');
        const playerName = getPlayerName(players, playerId);

        // Check if this guess was marked correct in rd.guesses
        const isCorrect = rd.guesses.some(
          (g) => g.playerId === playerId && g.text === guessText && g.isCorrect,
        );

        setChatMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.playerId === playerId && m.text === guessText && m.timestamp === entry.timestamp)) {
            return prev;
          }
          return [
            ...prev,
            {
              playerId,
              playerName,
              text: guessText,
              timestamp: entry.timestamp,
              isCorrect,
            },
          ];
        });
      }
    }

    processedActionsRef.current = actions.length;
  }, [isHost, rd?.actions?.length, rd?.guesses, rd?.performerId, players]);

  // ---------------------------------------------------------------------------
  // Sync guesses from roundData for non-host (when GAME_STATE_SYNC arrives)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isHost) return;
    if (!rd?.guesses) return;

    // If rd.guesses has entries we don't have in chat yet, add them
    for (const guess of rd.guesses) {
      setChatMessages((prev) => {
        const exists = prev.some(
          (m) =>
            m.playerId === guess.playerId &&
            m.text === guess.text &&
            Math.abs(m.timestamp - guess.timestamp) < 2000,
        );
        if (exists) {
          // Update isCorrect if changed
          return prev.map((m) =>
            m.playerId === guess.playerId &&
            m.text === guess.text &&
            Math.abs(m.timestamp - guess.timestamp) < 2000
              ? { ...m, isCorrect: guess.isCorrect }
              : m,
          );
        }
        return [
          ...prev,
          {
            playerId: guess.playerId,
            playerName: guess.playerName,
            text: guess.text,
            timestamp: guess.timestamp,
            isCorrect: guess.isCorrect,
          },
        ];
      });
    }
  }, [isHost, rd?.guesses]);

  // ---------------------------------------------------------------------------
  // Host: handle timer expiration - nobody guessed
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING) return;
    if (!rd) return;
    if (roundEndedRef.current) return;

    // Timer ran out, nobody guessed correctly
    roundEndedRef.current = true;

    const roundScores: Record<string, number> = {};
    for (const p of players) {
      roundScores[p.id] = 0;
    }

    const updatedRd: CharadesRoundData = {
      ...rd,
      correctGuesserId: null,
    };

    dispatch({
      type: 'END_ROUND',
      scores: roundScores,
      roundData: updatedRd,
    });

    transport?.send({
      type: 'ROUND_END',
      payload: { scores: roundScores, roundData: updatedRd },
    });
  }, [isHost, phase, rd, players, dispatch, transport]);

  // ---------------------------------------------------------------------------
  // After ROUND_ENDING, show summary then transition
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== GamePhase.ROUND_ENDING && phase !== GamePhase.GAME_ENDING) return;
    if (!rd) return;

    setShowRoundEnd(true);

    if (!isHost) return;

    const timer = setTimeout(() => {
      if (currentRound >= totalRounds) {
        endGame();
      } else {
        setShowTransition(true);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [isHost, phase, rd, currentRound, totalRounds, endGame]);

  // ---------------------------------------------------------------------------
  // Round transition complete -> start next round
  // ---------------------------------------------------------------------------
  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    setShowRoundEnd(false);

    if (!isHost) return;

    const nextRound = currentRound + 1;
    if (lastStartedRoundRef.current >= nextRound) return;
    lastStartedRoundRef.current = nextRound;

    const connectedPlayers = players.filter((p) => p.connected);
    if (connectedPlayers.length < 2) return;

    // Round-robin performer selection
    const performerIndex = (nextRound - 1) % connectedPlayers.length;
    const performer = connectedPlayers[performerIndex];

    const { prompt, category } = pickPrompt(usedPromptsRef.current);
    usedPromptsRef.current.add(prompt);

    const keywords = extractKeywords(prompt);

    const newRoundData: CharadesRoundData = {
      performerId: performer.id,
      prompt,
      category,
      keywords,
      correctGuesserId: null,
      guesses: [],
      passCount: 0,
      maxPasses: 2,
    };

    roundEndedRef.current = false;

    dispatch({ type: 'START_ROUND', roundData: newRoundData });

    transport?.send({
      type: 'ROUND_START',
      payload: { round: nextRound, data: newRoundData },
    });

    setChatMessages([
      {
        playerId: 'system',
        playerName: 'System',
        text: `Round ${nextRound}! ${performer.name} is performing. Category: ${category}`,
        timestamp: Date.now(),
        isCorrect: false,
      },
    ]);
  }, [isHost, currentRound, players, dispatch, transport]);

  // ---------------------------------------------------------------------------
  // Guesser: send guess
  // ---------------------------------------------------------------------------
  const handleSendGuess = useCallback(
    (text: string) => {
      if (!currentPlayerId || currentPlayerId === rd?.performerId) return;

      const sanitized = sanitizeMessage(text);
      if (!sanitized) return;

      playerAction({ type: 'guess', guess: sanitized });

      // Optimistically add to local chat
      setChatMessages((prev) => [
        ...prev,
        {
          playerId: currentPlayerId,
          playerName: getPlayerName(players, currentPlayerId),
          text: sanitized,
          timestamp: Date.now(),
          isCorrect: false,
        },
      ]);
    },
    [currentPlayerId, rd?.performerId, playerAction, players],
  );

  // ---------------------------------------------------------------------------
  // Performer: pass
  // ---------------------------------------------------------------------------
  const handlePass = useCallback(() => {
    if (!rd || rd.passCount >= rd.maxPasses) return;
    playerAction({ type: 'pass' });
  }, [rd, playerAction]);

  // ---------------------------------------------------------------------------
  // Performer/Host: confirm a guess manually
  // ---------------------------------------------------------------------------
  const handleConfirmGuess = useCallback(
    (guesserId: string) => {
      playerAction({ type: 'confirm_guess', playerId: guesserId });
    },
    [playerAction],
  );

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const performer = rd ? getPlayer(players, rd.performerId) : null;
  const isPerformer = currentPlayerId === rd?.performerId;

  const categoryColor =
    rd && CATEGORY_COLORS[rd.category]
      ? CATEGORY_COLORS[rd.category]
      : 'bg-white/10 text-white/60 border-white/20';

  // Round scores for display
  const roundScores = useMemo(() => {
    if (
      phase !== GamePhase.ROUND_ENDING &&
      phase !== GamePhase.GAME_ENDING
    )
      return {};
    if (!rd) return {};

    const rs: Record<string, number> = {};
    for (const p of players) {
      rs[p.id] = 0;
    }

    if (rd.correctGuesserId) {
      rs[rd.correctGuesserId] = calculateGuessPoints(timeRemaining, totalTime, 1);
      rs[rd.performerId] = Math.max(0, 300 - (rd.passCount || 0) * 100);
    }

    return rs;
  }, [phase, rd, players, timeRemaining, totalTime]);

  // Recent guesses for performer's confirm buttons
  const recentUnconfirmedGuesses = useMemo(() => {
    if (!rd) return [];
    return rd.guesses
      .filter((g) => !g.isCorrect && g.playerId !== rd.performerId)
      .slice(-5);
  }, [rd]);

  // ---------------------------------------------------------------------------
  // Render: Loading / Starting
  // ---------------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">
            Getting ready for Charades...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Results / Game Over
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Render: No round data
  // ---------------------------------------------------------------------------
  if (!rd) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Round Transition
  // ---------------------------------------------------------------------------
  if (showTransition) {
    return (
      <RoundTransition
        round={currentRound + 1}
        totalRounds={totalRounds}
        message="Next performer is up!"
        onComplete={handleTransitionComplete}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Determine if round has ended
  // ---------------------------------------------------------------------------
  const isRoundOver =
    phase === GamePhase.ROUND_ENDING || (phase as string) === GamePhase.GAME_ENDING;
  const wasGuessed = rd.correctGuesserId !== null;

  // ---------------------------------------------------------------------------
  // Main Layout
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen p-4 flex gap-4">
      {/* Main content area */}
      <div className="flex-1 flex flex-col gap-4 max-w-3xl mx-auto">
        {/* Top bar: round info + timer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg text-white/60">
              Round {currentRound}/{totalRounds}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-body border ${categoryColor}`}
            >
              {rd.category}
            </span>
          </div>
          <Timer
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            size="md"
            showSeconds
          />
        </div>

        {/* Performer info bar */}
        {performer && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
            <Avatar
              name={performer.name}
              color={performer.color}
              size="md"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg text-white">
                  {performer.name}
                  {isPerformer && (
                    <span className="text-neon-yellow ml-2">(You)</span>
                  )}
                </span>
                <Badge variant="host">PERFORMER</Badge>
              </div>
              <p className="font-body text-xs text-white/40">
                {isPerformer
                  ? 'Act it out on camera!'
                  : `Guess what ${performer.name} is acting!`}
              </p>
            </div>
          </div>
        )}

        {/* ===== PERFORMER VIEW ===== */}
        {isPerformer && !isRoundOver && (
          <div className="flex flex-col gap-4">
            {/* Secret prompt card */}
            <Card glow="yellow" className="text-center py-8 relative overflow-hidden">
              {/* Animated glow background */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(245,230,66,0.4) 0%, transparent 70%)',
                  animation: 'charadesGlow 3s ease-in-out infinite',
                }}
              />

              <div className="relative z-10">
                <p className="font-body text-sm text-neon-yellow/70 uppercase tracking-widest mb-3">
                  Act This Out
                </p>
                <h2 className="font-display text-4xl md:text-5xl text-neon-yellow leading-tight">
                  {rd.prompt}
                </h2>
                <span
                  className={`inline-block mt-4 px-3 py-1 rounded-full text-xs font-body border ${categoryColor}`}
                >
                  {rd.category}
                </span>
              </div>
            </Card>

            {/* Performer controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p
                  className="font-display text-lg text-neon-pink"
                  style={{ animation: 'charadesActBounce 2s ease-in-out infinite' }}
                >
                  Act it out! No talking!
                </p>
              </div>

              <Button
                variant="danger"
                size="sm"
                onClick={handlePass}
                disabled={rd.passCount >= rd.maxPasses}
              >
                Pass ({rd.maxPasses - rd.passCount} left) -100pts
              </Button>
            </div>

            {/* Manual confirm buttons for recent guesses */}
            {recentUnconfirmedGuesses.length > 0 && (
              <Card className="flex flex-col gap-2">
                <h4 className="font-display text-sm text-white/60">
                  Mark a guess as correct:
                </h4>
                <div className="flex flex-col gap-1.5">
                  {recentUnconfirmedGuesses.map((guess, idx) => (
                    <div
                      key={`${guess.playerId}-${idx}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xs text-neon-cyan">
                          {guess.playerName}:
                        </span>
                        <span className="font-body text-sm text-white/80">
                          {guess.text}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleConfirmGuess(guess.playerId)}
                      >
                        Correct
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ===== GUESSER VIEW ===== */}
        {!isPerformer && !isRoundOver && (
          <div className="flex flex-col gap-4">
            {/* Prompt hint area */}
            <Card glow="cyan" className="text-center py-8">
              <p className="font-body text-sm text-white/50 uppercase tracking-widest mb-3">
                Guess What They Are Acting
              </p>
              <h2 className="font-display text-3xl text-neon-cyan">
                Category: {rd.category}
              </h2>
              <p className="font-body text-sm text-white/40 mt-2">
                Watch{' '}
                <span className="text-neon-yellow">{performer?.name}</span> on
                camera and type your guess below!
              </p>
            </Card>

            {/* Close hint */}
            {closeHint && (
              <div className="text-center py-2 animate-pulse">
                <span className="font-display text-lg text-neon-yellow">
                  {closeHint}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ===== ROUND END SUMMARY ===== */}
        {isRoundOver && showRoundEnd && (
          <div className="flex flex-col gap-4">
            <Card glow={wasGuessed ? 'yellow' : 'pink'} className="text-center py-8">
              <p className="font-body text-sm text-white/50 uppercase tracking-widest mb-2">
                The answer was
              </p>
              <h2 className="font-display text-4xl text-neon-yellow mb-4">
                {rd.prompt}
              </h2>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-body border ${categoryColor}`}
              >
                {rd.category}
              </span>

              {wasGuessed ? (
                <div className="mt-6">
                  <p className="font-display text-xl text-neon-green">
                    {getPlayerName(players, rd.correctGuesserId!)} guessed it!
                  </p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="font-display text-xl text-neon-pink">
                    Nobody guessed it!
                  </p>
                </div>
              )}
            </Card>

            {/* Round scores */}
            <Card>
              <h3 className="font-display text-lg text-neon-yellow mb-3">
                Round Scores
              </h3>
              <div className="flex flex-col gap-2">
                {players
                  .slice()
                  .sort(
                    (a, b) =>
                      (roundScores[b.id] ?? 0) - (roundScores[a.id] ?? 0),
                  )
                  .map((player) => {
                    const pts = roundScores[player.id] ?? 0;
                    const isPerf = player.id === rd.performerId;
                    const isGuesser = player.id === rd.correctGuesserId;

                    return (
                      <div
                        key={player.id}
                        className={[
                          'flex items-center justify-between px-4 py-2 rounded-lg',
                          isGuesser
                            ? 'bg-emerald-500/10'
                            : isPerf && wasGuessed
                              ? 'bg-neon-yellow/10'
                              : 'bg-white/5',
                          player.id === currentPlayerId
                            ? 'ring-1 ring-neon-cyan/40'
                            : '',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={player.name}
                            color={player.color}
                            size="sm"
                          />
                          <span className="font-body text-sm text-white">
                            {player.name}
                            {player.id === currentPlayerId && (
                              <span className="text-white/40 ml-1">(You)</span>
                            )}
                          </span>
                          {isPerf && (
                            <Badge variant="host">PERFORMER</Badge>
                          )}
                          {isGuesser && (
                            <Badge variant="ready">CORRECT</Badge>
                          )}
                        </div>
                        <span
                          className={[
                            'font-mono text-sm font-bold',
                            pts > 0
                              ? 'text-neon-yellow'
                              : 'text-white/40',
                          ].join(' ')}
                        >
                          +{pts}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Right sidebar: chat + scoreboard */}
      <div className="hidden md:flex md:w-80 lg:w-96 shrink-0 flex-col gap-4">
        {/* Chat panel for guessing */}
        <div className="flex-1 min-h-0">
          <ChatPanel
            messages={chatMessages}
            onSend={handleSendGuess}
            disabled={isPerformer || isRoundOver || rd.correctGuesserId !== null}
            placeholder={
              isPerformer
                ? 'You are performing - no typing!'
                : rd.correctGuesserId
                  ? 'Round over!'
                  : 'Type your guess...'
            }
          />
        </div>

        {/* Mini scoreboard */}
        <Card>
          <Scoreboard
            scores={scores}
            players={players}
            currentPlayerId={currentPlayerId ?? ''}
          />
        </Card>
      </div>

      {/* Mobile: floating chat input for guessers */}
      {!isPerformer && !isRoundOver && !rd.correctGuesserId && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-navy-900/95 backdrop-blur-md border-t border-white/10 z-40">
          <MobileGuessInput onSend={handleSendGuess} />
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes charadesGlow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.05); }
        }
        @keyframes charadesActBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Mobile Guess Input sub-component
// ---------------------------------------------------------------------------

const MobileGuessInput: React.FC<{ onSend: (text: string) => void }> = ({
  onSend,
}) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = sanitizeMessage(input);
    if (!sanitized) return;
    onSend(sanitized);
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your guess..."
        maxLength={200}
        className={[
          'flex-1 font-body text-sm text-white bg-navy-700 rounded-lg px-3 py-2.5',
          'placeholder:text-white/25 border border-white/10',
          'focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/30',
          'transition-all duration-200',
        ].join(' ')}
      />
      <button
        type="submit"
        disabled={!input.trim()}
        className={[
          'shrink-0 px-4 py-2.5 rounded-lg font-display text-sm',
          'bg-neon-cyan text-navy-900',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          'transition-all duration-200',
        ].join(' ')}
      >
        Guess
      </button>
    </form>
  );
};

export default CharadesGame;
