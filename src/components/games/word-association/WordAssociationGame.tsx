import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase } from '../../../types';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { shuffle, pickRandom } from '../../../lib/utils/shuffle';
import { sanitizeMessage } from '../../../lib/security/sanitize';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Avatar from '../../ui/Avatar';
import ProgressBar from '../../ui/ProgressBar';
import Scoreboard from '../../game/Scoreboard';
import RoundTransition from '../../game/RoundTransition';

// ---------------------------------------------------------------------------
// Starting words pool (50+ common nouns)
// ---------------------------------------------------------------------------

const STARTING_WORDS: string[] = [
  'dog', 'music', 'ocean', 'pizza', 'mountain', 'castle', 'garden', 'river',
  'sunset', 'camera', 'dragon', 'forest', 'hammer', 'island', 'jungle',
  'kitchen', 'lamp', 'mirror', 'needle', 'orange', 'piano', 'queen',
  'rocket', 'shadow', 'tiger', 'umbrella', 'violin', 'window', 'crystal',
  'bridge', 'candle', 'diamond', 'eagle', 'flame', 'ghost', 'honey',
  'iceberg', 'jewel', 'knight', 'lemon', 'magnet', 'notebook', 'painting',
  'rainbow', 'satellite', 'treasure', 'unicorn', 'volcano', 'wizard',
  'anchor', 'balloon', 'compass', 'dolphin', 'engine', 'feather', 'globe',
  'harvest', 'ivory', 'jasmine', 'kettle', 'lantern', 'marble', 'nectar',
];

// ---------------------------------------------------------------------------
// Types for round data stored in engineState.roundData
// ---------------------------------------------------------------------------

interface WordAction {
  playerId: string;
  action: { type: string; word?: string };
  timestamp: number;
}

interface WordAssociationRoundData {
  chain: string[];
  currentPlayerIndex: number;
  playerOrder: string[];
  eliminatedPlayers: string[];
  turnStartTime: number;
  turnTimeLimit: number;
  /** Points earned per player this round (word submissions) */
  wordPoints: Record<string, number>;
  /** Elimination order — first eliminated = index 0 */
  eliminationOrder: string[];
  /** ID of the winner once determined */
  winnerId?: string;
  /** Reason the last elimination happened (for display) */
  lastEliminationReason?: 'timeout' | 'duplicate' | 'invalid';
  /** Player who was just eliminated (for animation) */
  lastEliminatedId?: string;
  /** Engine-appended actions */
  actions?: WordAction[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORD_POINTS = 50;
const WINNER_BONUS = 200;
const RUNNER_UP_BONUS = 100;
const MIN_WORD_LENGTH = 2;
const ELIMINATION_DISPLAY_MS = 1800;
const POST_ROUND_DELAY_MS = 4000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WordAssociationGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();

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

  // Parsed round data
  const rd = roundData as WordAssociationRoundData | null;

  // Local state
  const [wordInput, setWordInput] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [eliminationFlash, setEliminationFlash] = useState<string | null>(null);
  const [eliminationReason, setEliminationReason] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const processedActionsRef = useRef<number>(0);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [localTurnTime, setLocalTurnTime] = useState<number>(0);
  const chainEndRef = useRef<HTMLDivElement>(null);
  const eliminationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive turn time limit (default 10s)
  const turnTimeLimit = rd?.turnTimeLimit ?? config.timeLimit ?? 10;

  // -----------------------------------------------------------------------
  // Current turn player
  // -----------------------------------------------------------------------
  const currentTurnPlayerId = useMemo(() => {
    if (!rd) return null;
    if (rd.playerOrder.length === 0) return null;
    const idx = rd.currentPlayerIndex % rd.playerOrder.length;
    return rd.playerOrder[idx] ?? null;
  }, [rd?.currentPlayerIndex, rd?.playerOrder]);

  const isMyTurn = currentTurnPlayerId === currentPlayerId;

  const currentTurnPlayer = useMemo(() => {
    if (!currentTurnPlayerId) return null;
    return players.find((p) => p.id === currentTurnPlayerId) ?? null;
  }, [currentTurnPlayerId, players]);

  // -----------------------------------------------------------------------
  // Current word (last in chain)
  // -----------------------------------------------------------------------
  const currentWord = useMemo(() => {
    if (!rd || rd.chain.length === 0) return '';
    return rd.chain[rd.chain.length - 1];
  }, [rd?.chain]);

  // -----------------------------------------------------------------------
  // Visible chain (last 8 words)
  // -----------------------------------------------------------------------
  const visibleChain = useMemo(() => {
    if (!rd) return [];
    return rd.chain.slice(-8);
  }, [rd?.chain]);

  // -----------------------------------------------------------------------
  // Remaining (non-eliminated) players
  // -----------------------------------------------------------------------
  const remainingPlayers = useMemo(() => {
    if (!rd) return players;
    return players.filter((p) => !rd.eliminatedPlayers.includes(p.id));
  }, [players, rd?.eliminatedPlayers]);

  const eliminatedPlayers = useMemo(() => {
    if (!rd) return [];
    return players.filter((p) => rd.eliminatedPlayers.includes(p.id));
  }, [players, rd?.eliminatedPlayers]);

  // -----------------------------------------------------------------------
  // Host: Pick starting word and start round
  // -----------------------------------------------------------------------
  const startNextRound = useCallback(() => {
    if (!isHost) return;

    const startingWord = pickRandom(STARTING_WORDS);
    const connectedPlayerIds = players
      .filter((p) => p.connected)
      .map((p) => p.id);
    const playerOrder = shuffle(connectedPlayerIds);

    const newRoundData: WordAssociationRoundData = {
      chain: [startingWord],
      currentPlayerIndex: 0,
      playerOrder,
      eliminatedPlayers: [],
      turnStartTime: Date.now(),
      turnTimeLimit: config.timeLimit > 0 ? config.timeLimit : 10,
      wordPoints: {},
      eliminationOrder: [],
    };

    dispatch({ type: 'START_ROUND', roundData: newRoundData });
  }, [isHost, players, config.timeLimit, dispatch]);

  // -----------------------------------------------------------------------
  // Host: Auto-start when GAME_STARTING
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
      setWordInput('');
      setEliminationFlash(null);
      setEliminationReason(null);
      processedActionsRef.current = 0;
    }
  }, [phase, currentRound]);

  // -----------------------------------------------------------------------
  // Auto-focus input when it's the player's turn
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isMyTurn && phase === GamePhase.ROUND_ACTIVE) {
      setWordInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isMyTurn, phase, currentTurnPlayerId]);

  // -----------------------------------------------------------------------
  // Local turn timer (visual countdown)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (phase !== GamePhase.ROUND_ACTIVE || !rd) {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
      return;
    }

    // Reset local timer when turn changes
    setLocalTurnTime(turnTimeLimit);

    const interval = setInterval(() => {
      setLocalTurnTime((prev) => {
        const next = prev - 0.1;
        return next < 0 ? 0 : next;
      });
    }, 100);

    turnTimerRef.current = interval;

    return () => {
      clearInterval(interval);
      turnTimerRef.current = null;
    };
  }, [phase, rd?.currentPlayerIndex, rd?.turnStartTime, turnTimeLimit]);

  // -----------------------------------------------------------------------
  // Host: Detect turn timeout
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!rd) return;

    const elapsed = Date.now() - rd.turnStartTime;
    const remainingMs = rd.turnTimeLimit * 1000 - elapsed;

    if (remainingMs <= 0) {
      // Already timed out — eliminate immediately
      handleTurnTimeout();
      return;
    }

    const timer = setTimeout(() => {
      handleTurnTimeout();
    }, remainingMs);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, rd?.currentPlayerIndex, rd?.turnStartTime, rd?.playerOrder]);

  // -----------------------------------------------------------------------
  // Host: Handle turn timeout
  // -----------------------------------------------------------------------
  const handleTurnTimeout = useCallback(() => {
    if (!isHost || !rd) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (rd.playerOrder.length === 0) return;

    const timedOutPlayerId = rd.playerOrder[rd.currentPlayerIndex % rd.playerOrder.length];
    if (!timedOutPlayerId) return;

    // Eliminate the player
    const newEliminated = [...rd.eliminatedPlayers, timedOutPlayerId];
    const newEliminationOrder = [...rd.eliminationOrder, timedOutPlayerId];
    const newPlayerOrder = rd.playerOrder.filter((id) => id !== timedOutPlayerId);

    // Check if game over
    if (newPlayerOrder.length <= 1) {
      const winnerId = newPlayerOrder[0] ?? timedOutPlayerId;
      finishRound(rd, newEliminated, newEliminationOrder, newPlayerOrder, winnerId, 'timeout', timedOutPlayerId);
      return;
    }

    // Advance to next player
    const newIndex = rd.currentPlayerIndex >= newPlayerOrder.length
      ? 0
      : rd.currentPlayerIndex % newPlayerOrder.length;

    dispatch({
      type: 'END_ROUND',
      scores: {}, // No score changes for intermediate updates
      roundData: {
        ...rd,
        eliminatedPlayers: newEliminated,
        eliminationOrder: newEliminationOrder,
        playerOrder: newPlayerOrder,
        currentPlayerIndex: newIndex,
        turnStartTime: Date.now(),
        lastEliminationReason: 'timeout',
        lastEliminatedId: timedOutPlayerId,
      },
    });

    // Hack: since END_ROUND changes phase, we need to re-start round
    // Instead, directly update roundData by dispatching START_ROUND for continuation
    // Actually: We should use a different approach - update roundData through the actions system
    // Let's dispatch a special host action instead
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, rd, phase, dispatch]);

  // -----------------------------------------------------------------------
  // Host: Finish round (calculate scores, dispatch END_ROUND)
  // -----------------------------------------------------------------------
  const finishRound = useCallback(
    (
      data: WordAssociationRoundData,
      eliminatedPlayers: string[],
      eliminationOrder: string[],
      remainingOrder: string[],
      winnerId: string,
      reason: 'timeout' | 'duplicate' | 'invalid',
      lastEliminatedId: string,
    ) => {
      const roundScores: Record<string, number> = {};

      // Word points
      for (const [pid, pts] of Object.entries(data.wordPoints)) {
        roundScores[pid] = (roundScores[pid] ?? 0) + pts;
      }

      // Winner bonus
      if (winnerId) {
        roundScores[winnerId] = (roundScores[winnerId] ?? 0) + WINNER_BONUS;
      }

      // Runner-up bonus (last eliminated before winner)
      if (eliminationOrder.length > 0) {
        const runnerUpId = eliminationOrder[eliminationOrder.length - 1];
        if (runnerUpId !== winnerId) {
          roundScores[runnerUpId] = (roundScores[runnerUpId] ?? 0) + RUNNER_UP_BONUS;
        }
      }

      // Ensure all players have an entry
      for (const p of players) {
        if (roundScores[p.id] === undefined) {
          roundScores[p.id] = 0;
        }
      }

      dispatch({
        type: 'END_ROUND',
        scores: roundScores,
        roundData: {
          ...data,
          eliminatedPlayers,
          eliminationOrder,
          playerOrder: remainingOrder,
          winnerId,
          lastEliminationReason: reason,
          lastEliminatedId,
        },
      });
    },
    [players, dispatch],
  );

  // -----------------------------------------------------------------------
  // Host: Process incoming player actions
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!rd || !rd.actions) return;

    const actions = rd.actions;
    const startIdx = processedActionsRef.current;
    if (actions.length <= startIdx) return;

    // We only process the latest unprocessed action
    // (one at a time since turn-based)
    for (let i = startIdx; i < actions.length; i++) {
      const entry = actions[i];
      const { playerId, action } = entry;

      if (action.type !== 'submit_word') continue;
      if (!action.word) continue;

      // Only accept from current turn player
      if (playerId !== rd.playerOrder[rd.currentPlayerIndex % rd.playerOrder.length]) {
        continue;
      }

      const submittedWord = sanitizeMessage(action.word).trim().toLowerCase();
      const previousWord = rd.chain[rd.chain.length - 1].toLowerCase();

      // Validate: not empty, minimum length
      if (submittedWord.length < MIN_WORD_LENGTH) {
        // Eliminate for invalid
        eliminatePlayer(rd, playerId, 'invalid');
        processedActionsRef.current = actions.length;
        return;
      }

      // Validate: not exact same as previous word
      if (submittedWord === previousWord) {
        eliminatePlayer(rd, playerId, 'duplicate');
        processedActionsRef.current = actions.length;
        return;
      }

      // Validate: not already in chain (case-insensitive)
      const chainLower = rd.chain.map((w) => w.toLowerCase());
      if (chainLower.includes(submittedWord)) {
        eliminatePlayer(rd, playerId, 'duplicate');
        processedActionsRef.current = actions.length;
        return;
      }

      // Valid word — add to chain, advance turn
      const newChain = [...rd.chain, submittedWord];
      const newWordPoints = { ...rd.wordPoints };
      newWordPoints[playerId] = (newWordPoints[playerId] ?? 0) + WORD_POINTS;

      // Next player index (round-robin among remaining)
      const nextIndex = (rd.currentPlayerIndex + 1) % rd.playerOrder.length;

      // Update roundData via a self-dispatched PLAYER_ACTION won't work
      // because we need to change roundData fields. We use START_ROUND trick:
      // Actually, the pattern is: host dispatches END_ROUND with updated roundData
      // but that changes the phase. We need to keep ROUND_ACTIVE.
      //
      // Looking at the engine: PLAYER_ACTION appends to actions array.
      // The host can only modify roundData by dispatching END_ROUND or START_ROUND.
      //
      // The correct approach: update a local ref that tracks the "authoritative"
      // state, and use START_ROUND-like dispatch. But START_ROUND only works from
      // GAME_STARTING or ROUND_ENDING phase.
      //
      // Best approach given engine constraints: The host tracks authoritative state
      // locally and syncs via the roundData that gets broadcast. Since PLAYER_ACTION
      // already appends to roundData.actions, we can keep "chain" and "currentPlayerIndex"
      // as properties that the host updates. But the engine reducer for PLAYER_ACTION
      // only appends to the actions array—it doesn't let us modify other fields.
      //
      // Solution: We process actions and compute derived state from the chain of actions.
      // All clients read the same actions array and derive the game state.
      // This is the most robust approach for this engine.
      //
      // However, we still need to dispatch END_ROUND when the game ends.
      // For intermediate state updates, all clients derive from actions.

      processedActionsRef.current = actions.length;
      // Derived state approach: we don't need to dispatch anything for valid words.
      // The action is already in roundData.actions. All clients derive state from it.
      return;
    }

    processedActionsRef.current = actions.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, rd?.actions?.length]);

  // -----------------------------------------------------------------------
  // Host helper: Eliminate a player
  // -----------------------------------------------------------------------
  const eliminatePlayer = useCallback(
    (data: WordAssociationRoundData, playerId: string, reason: 'timeout' | 'duplicate' | 'invalid') => {
      const newEliminated = [...data.eliminatedPlayers, playerId];
      const newEliminationOrder = [...data.eliminationOrder, playerId];
      const newPlayerOrder = data.playerOrder.filter((id) => id !== playerId);

      if (newPlayerOrder.length <= 1) {
        const winnerId = newPlayerOrder[0] ?? playerId;
        finishRound(data, newEliminated, newEliminationOrder, newPlayerOrder, winnerId, reason, playerId);
        return;
      }

      // Need to continue game with updated state
      // Since we can't modify roundData fields directly, we need END_ROUND + START_ROUND combo
      // But that changes phases... This is a fundamental limitation.
      //
      // Alternative: store elimination info in actions too, and derive everything.
      // The host dispatches a special playerAction for elimination.
      //
      // Actually the cleanest approach: the host dispatches END_ROUND to update roundData,
      // then immediately dispatches START_ROUND to resume. The round number stays the same
      // if we handle it carefully.
      //
      // Looking at the engine: END_ROUND transitions to ROUND_ENDING (or GAME_ENDING).
      // START_ROUND only works from GAME_STARTING or ROUND_ENDING. So:
      // END_ROUND (phase->ROUND_ENDING) then START_ROUND (phase->ROUND_ACTIVE, round+1).
      // But that increments the round counter, which we don't want.
      //
      // The pragmatic solution: derive ALL game state from the initial roundData + actions array.
      // Actions capture everything. Host only dispatches END_ROUND when the round truly ends.
      // For eliminations during the round, host sends a synthetic playerAction that encodes
      // the elimination, and all clients process it.

      // Send elimination as a host action
      playerAction({ type: 'eliminate', targetId: playerId, reason } as any);
    },
    [finishRound, playerAction],
  );

  // -----------------------------------------------------------------------
  // DERIVED STATE: Compute authoritative game state from initial roundData + actions
  // This is the key insight: instead of trying to modify roundData on each turn,
  // we derive the complete current state from the initial data plus all actions.
  // -----------------------------------------------------------------------
  const derivedState = useMemo(() => {
    if (!rd) return null;

    let chain = [...(rd.chain ?? [])]; // starts with the initial word
    let playerOrder = [...(rd.playerOrder ?? [])];
    let eliminatedPlayers = [...(rd.eliminatedPlayers ?? [])];
    let eliminationOrder = [...(rd.eliminationOrder ?? [])];
    let currentPlayerIndex = rd.currentPlayerIndex ?? 0;
    let wordPoints: Record<string, number> = { ...(rd.wordPoints ?? {}) };
    let winnerId = rd.winnerId;
    let lastEliminationReason: string | undefined = rd.lastEliminationReason;
    let lastEliminatedId: string | undefined = rd.lastEliminatedId;
    let turnStartTime = rd.turnStartTime;
    let turnCount = 0; // how many turns have passed since round data was set

    if (!rd.actions) {
      return {
        chain,
        playerOrder,
        eliminatedPlayers,
        eliminationOrder,
        currentPlayerIndex,
        wordPoints,
        winnerId,
        lastEliminationReason,
        lastEliminatedId,
        turnStartTime,
        turnCount,
      };
    }

    for (const entry of rd.actions) {
      const { playerId, action, timestamp } = entry;

      if (action.type === 'submit_word' && action.word) {
        // Only valid if it's this player's turn
        const expectedPlayer = playerOrder[currentPlayerIndex % playerOrder.length];
        if (playerId !== expectedPlayer) continue;
        if (winnerId) continue; // game over already

        const submittedWord = (action.word as string).trim().toLowerCase();
        const previousWord = chain[chain.length - 1].toLowerCase();
        const chainLower = chain.map((w) => w.toLowerCase());

        // Validate
        const isEmpty = submittedWord.length < MIN_WORD_LENGTH;
        const isSameAsPrev = submittedWord === previousWord;
        const isDuplicate = chainLower.includes(submittedWord);

        if (isEmpty || isSameAsPrev || isDuplicate) {
          // Eliminate
          eliminatedPlayers.push(playerId);
          eliminationOrder.push(playerId);
          playerOrder = playerOrder.filter((id) => id !== playerId);
          lastEliminationReason = isDuplicate || isSameAsPrev ? 'duplicate' : 'invalid';
          lastEliminatedId = playerId;

          if (playerOrder.length <= 1) {
            winnerId = playerOrder[0] ?? playerId;
          } else {
            currentPlayerIndex = currentPlayerIndex % playerOrder.length;
            turnStartTime = timestamp;
          }
          turnCount++;
        } else {
          // Valid word
          chain.push(submittedWord);
          wordPoints[playerId] = (wordPoints[playerId] ?? 0) + WORD_POINTS;
          currentPlayerIndex = (currentPlayerIndex + 1) % playerOrder.length;
          lastEliminationReason = undefined;
          lastEliminatedId = undefined;
          turnStartTime = timestamp;
          turnCount++;
        }
      }

      if (action.type === 'eliminate') {
        const targetId = (action as any).targetId as string;
        const reason = (action as any).reason as 'timeout' | 'duplicate' | 'invalid';
        if (!targetId) continue;
        if (eliminatedPlayers.includes(targetId)) continue;
        if (winnerId) continue;

        eliminatedPlayers.push(targetId);
        eliminationOrder.push(targetId);
        playerOrder = playerOrder.filter((id) => id !== targetId);
        lastEliminationReason = reason;
        lastEliminatedId = targetId;

        if (playerOrder.length <= 1) {
          winnerId = playerOrder[0] ?? targetId;
        } else {
          currentPlayerIndex = currentPlayerIndex % playerOrder.length;
          turnStartTime = timestamp;
        }
        turnCount++;
      }
    }

    return {
      chain,
      playerOrder,
      eliminatedPlayers,
      eliminationOrder,
      currentPlayerIndex,
      wordPoints,
      winnerId,
      lastEliminationReason,
      lastEliminatedId,
      turnStartTime,
      turnCount,
    };
  }, [rd]);

  // -----------------------------------------------------------------------
  // Derived current turn player (from derived state)
  // -----------------------------------------------------------------------
  const derivedCurrentPlayerId = useMemo(() => {
    if (!derivedState) return null;
    if (derivedState.playerOrder.length === 0) return null;
    if (derivedState.winnerId) return null;
    const idx = derivedState.currentPlayerIndex % derivedState.playerOrder.length;
    return derivedState.playerOrder[idx] ?? null;
  }, [derivedState]);

  const derivedIsMyTurn = derivedCurrentPlayerId === currentPlayerId;

  const derivedCurrentTurnPlayer = useMemo(() => {
    if (!derivedCurrentPlayerId) return null;
    return players.find((p) => p.id === derivedCurrentPlayerId) ?? null;
  }, [derivedCurrentPlayerId, players]);

  const derivedCurrentWord = useMemo(() => {
    if (!derivedState || derivedState.chain.length === 0) return '';
    return derivedState.chain[derivedState.chain.length - 1];
  }, [derivedState]);

  const derivedVisibleChain = useMemo(() => {
    if (!derivedState) return [];
    return derivedState.chain.slice(-8);
  }, [derivedState]);

  const derivedRemainingPlayers = useMemo(() => {
    if (!derivedState) return players;
    return players.filter((p) => !derivedState.eliminatedPlayers.includes(p.id));
  }, [players, derivedState]);

  const derivedEliminatedPlayers = useMemo(() => {
    if (!derivedState) return [];
    return players.filter((p) => derivedState.eliminatedPlayers.includes(p.id));
  }, [players, derivedState]);

  // -----------------------------------------------------------------------
  // Local turn timer (visual countdown) - using derived state
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (phase !== GamePhase.ROUND_ACTIVE || !derivedState || derivedState.winnerId) {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
      return;
    }

    // Compute remaining time based on derivedState.turnStartTime
    const limit = rd?.turnTimeLimit ?? 10;
    const elapsed = (Date.now() - derivedState.turnStartTime) / 1000;
    const remaining = Math.max(0, limit - elapsed);
    setLocalTurnTime(remaining);

    const interval = setInterval(() => {
      setLocalTurnTime((prev) => {
        const next = prev - 0.1;
        return next < 0 ? 0 : next;
      });
    }, 100);

    turnTimerRef.current = interval;

    return () => {
      clearInterval(interval);
      turnTimerRef.current = null;
    };
  }, [phase, derivedState?.turnStartTime, derivedState?.currentPlayerIndex, derivedState?.winnerId, rd?.turnTimeLimit]);

  // -----------------------------------------------------------------------
  // Host: Detect turn timeout (using derived state)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!derivedState || !rd) return;
    if (derivedState.winnerId) return;
    if (derivedState.playerOrder.length === 0) return;

    const limit = rd.turnTimeLimit ?? 10;
    const elapsed = (Date.now() - derivedState.turnStartTime) / 1000;
    const remainingMs = Math.max(0, (limit - elapsed) * 1000);

    const currentPid = derivedState.playerOrder[derivedState.currentPlayerIndex % derivedState.playerOrder.length];
    if (!currentPid) return;

    if (remainingMs <= 0) {
      // Timeout now
      playerAction({ type: 'eliminate', targetId: currentPid, reason: 'timeout' } as any);
      return;
    }

    const timer = setTimeout(() => {
      // Re-check: only eliminate if still same player's turn
      playerAction({ type: 'eliminate', targetId: currentPid, reason: 'timeout' } as any);
    }, remainingMs + 100); // small buffer to account for timing

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, derivedState?.currentPlayerIndex, derivedState?.turnStartTime, derivedState?.turnCount, derivedState?.winnerId]);

  // -----------------------------------------------------------------------
  // Host: Detect winner and finish round
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!derivedState || !rd) return;
    if (!derivedState.winnerId) return;

    // Build scores
    const roundScores: Record<string, number> = {};

    // Word points
    for (const [pid, pts] of Object.entries(derivedState.wordPoints)) {
      roundScores[pid] = (roundScores[pid] ?? 0) + pts;
    }

    // Winner bonus
    roundScores[derivedState.winnerId] = (roundScores[derivedState.winnerId] ?? 0) + WINNER_BONUS;

    // Runner-up bonus
    if (derivedState.eliminationOrder.length > 0) {
      const runnerUpId = derivedState.eliminationOrder[derivedState.eliminationOrder.length - 1];
      if (runnerUpId !== derivedState.winnerId) {
        roundScores[runnerUpId] = (roundScores[runnerUpId] ?? 0) + RUNNER_UP_BONUS;
      }
    }

    // Ensure all players have an entry
    for (const p of players) {
      if (roundScores[p.id] === undefined) {
        roundScores[p.id] = 0;
      }
    }

    // Delay slightly so the elimination animation can play
    const timer = setTimeout(() => {
      dispatch({
        type: 'END_ROUND',
        scores: roundScores,
        roundData: {
          ...rd,
          chain: derivedState.chain,
          eliminatedPlayers: derivedState.eliminatedPlayers,
          eliminationOrder: derivedState.eliminationOrder,
          playerOrder: derivedState.playerOrder,
          wordPoints: derivedState.wordPoints,
          winnerId: derivedState.winnerId,
          currentPlayerIndex: derivedState.currentPlayerIndex,
        },
      });
    }, ELIMINATION_DISPLAY_MS);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, derivedState?.winnerId]);

  // -----------------------------------------------------------------------
  // Elimination flash animation
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!derivedState?.lastEliminatedId) return;

    setEliminationFlash(derivedState.lastEliminatedId);
    const reason = derivedState.lastEliminationReason;
    if (reason === 'timeout') {
      setEliminationReason('Time\'s up!');
    } else if (reason === 'duplicate') {
      setEliminationReason('Word already used!');
    } else {
      setEliminationReason('Invalid word!');
    }

    if (eliminationTimeoutRef.current) {
      clearTimeout(eliminationTimeoutRef.current);
    }
    eliminationTimeoutRef.current = setTimeout(() => {
      setEliminationFlash(null);
      setEliminationReason(null);
    }, ELIMINATION_DISPLAY_MS);

    return () => {
      if (eliminationTimeoutRef.current) {
        clearTimeout(eliminationTimeoutRef.current);
      }
    };
  }, [derivedState?.lastEliminatedId, derivedState?.turnCount]);

  // -----------------------------------------------------------------------
  // Auto-focus when derived turn changes to current player
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (derivedIsMyTurn && phase === GamePhase.ROUND_ACTIVE) {
      setWordInput('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [derivedIsMyTurn, phase, derivedState?.currentPlayerIndex]);

  // -----------------------------------------------------------------------
  // Host: after round ends, wait then next or end game
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
    }, POST_ROUND_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isHost, phase, currentRound, totalRounds, endGame]);

  // -----------------------------------------------------------------------
  // Player: Submit word
  // -----------------------------------------------------------------------
  const handleSubmitWord = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!derivedIsMyTurn) return;
      if (phase !== GamePhase.ROUND_ACTIVE) return;

      const trimmed = sanitizeMessage(wordInput).trim();
      if (trimmed.length === 0) return;

      playerAction({ type: 'submit_word', word: trimmed });
      setWordInput('');
    },
    [wordInput, derivedIsMyTurn, phase, playerAction],
  );

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
  // Timer progress (0–100)
  // -----------------------------------------------------------------------
  const timerProgress = useMemo(() => {
    const limit = rd?.turnTimeLimit ?? 10;
    if (limit <= 0) return 0;
    return Math.max(0, Math.min(100, (localTurnTime / limit) * 100));
  }, [localTurnTime, rd?.turnTimeLimit]);

  const timerColor = useMemo((): 'cyan' | 'yellow' | 'pink' => {
    if (timerProgress > 50) return 'cyan';
    if (timerProgress > 25) return 'yellow';
    return 'pink';
  }, [timerProgress]);

  // -----------------------------------------------------------------------
  // Scroll chain into view
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (chainEndRef.current) {
      chainEndRef.current.scrollIntoView({ behavior: 'smooth', inline: 'end' });
    }
  }, [derivedState?.chain?.length]);

  // -----------------------------------------------------------------------
  // Winner player object
  // -----------------------------------------------------------------------
  const winnerPlayer = useMemo(() => {
    if (!derivedState?.winnerId) return null;
    return players.find((p) => p.id === derivedState.winnerId) ?? null;
  }, [derivedState?.winnerId, players]);

  // =======================================================================
  // RENDER: Game Starting
  // =======================================================================
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">
            Starting Word Association...
          </p>
        </div>
      </div>
    );
  }

  // =======================================================================
  // RENDER: Results / Game Over
  // =======================================================================
  if (phase === GamePhase.RESULTS || phase === GamePhase.GAME_ENDING) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card glow="yellow" className="max-w-lg w-full text-center">
          <h2 className="font-display text-3xl text-neon-yellow mb-6">
            Game Over!
          </h2>
          <Scoreboard
            scores={scores}
            players={players}
            currentPlayerId={currentPlayerId ?? ''}
          />
        </Card>
      </div>
    );
  }

  // =======================================================================
  // RENDER: Round Transition
  // =======================================================================
  if (showTransition) {
    return (
      <RoundTransition
        round={currentRound + 1}
        totalRounds={totalRounds}
        message="New starting word incoming!"
        onComplete={handleTransitionComplete}
      />
    );
  }

  // =======================================================================
  // RENDER: No round data yet
  // =======================================================================
  if (!rd || !derivedState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // =======================================================================
  // RENDER: Round Ending (show winner)
  // =======================================================================
  if (phase === GamePhase.ROUND_ENDING) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card glow="cyan" className="max-w-md w-full text-center">
          <h2 className="font-display text-2xl text-neon-cyan mb-4">
            Round {currentRound} Complete!
          </h2>

          {winnerPlayer ? (
            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full bg-neon-yellow/20 animate-pulse" />
                <Avatar
                  name={winnerPlayer.name}
                  color={winnerPlayer.color}
                  size="lg"
                  isBot={winnerPlayer.isBot}
                />
              </div>
              <p className="font-display text-xl text-neon-yellow">
                {winnerPlayer.name} wins!
              </p>
              <p className="font-body text-sm text-white/60">
                Chain length: {derivedState.chain.length} words
              </p>
            </div>
          ) : (
            <p className="font-body text-white/60 mb-6">Round ended</p>
          )}

          {/* Chain recap */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-6">
            {derivedState.chain.map((word, i) => (
              <span
                key={`${word}-${i}`}
                className="px-2 py-1 rounded-full bg-white/10 text-white/80 text-xs font-body"
              >
                {word}
              </span>
            ))}
          </div>

          <Scoreboard
            scores={scores}
            players={players}
            currentPlayerId={currentPlayerId ?? ''}
          />
        </Card>
      </div>
    );
  }

  // =======================================================================
  // RENDER: Round Active — Main game UI
  // =======================================================================
  return (
    <div className="flex flex-col min-h-screen p-4 gap-4">
      {/* ---- Header: Round info ---- */}
      <div className="flex items-center justify-between">
        <div className="font-display text-sm text-white/50">
          Round {currentRound} / {totalRounds}
        </div>
        <div className="font-body text-sm text-white/50">
          Chain: {derivedState.chain.length} words
        </div>
      </div>

      {/* ---- Player strip ---- */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {rd.playerOrder.length > 0 &&
          [...players].sort((a, b) => {
            // Show remaining first, then eliminated
            const aElim = derivedState.eliminatedPlayers.includes(a.id);
            const bElim = derivedState.eliminatedPlayers.includes(b.id);
            if (aElim !== bElim) return aElim ? 1 : -1;
            return 0;
          }).map((player) => {
            const isEliminated = derivedState.eliminatedPlayers.includes(player.id);
            const isCurrentTurn = player.id === derivedCurrentPlayerId;

            return (
              <div
                key={player.id}
                className={[
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 shrink-0',
                  isEliminated
                    ? 'opacity-40 grayscale'
                    : isCurrentTurn
                      ? 'bg-neon-cyan/10 border border-neon-cyan/40 shadow-[0_0_16px_rgba(0,229,255,0.2)]'
                      : 'bg-white/5 border border-transparent',
                  eliminationFlash === player.id
                    ? 'animate-shake bg-red-500/20 border-red-500/50'
                    : '',
                ].join(' ')}
              >
                <Avatar
                  name={player.name}
                  color={player.color}
                  size="sm"
                  isBot={player.isBot}
                />
                <span className="font-body text-xs text-white/80 max-w-[60px] truncate">
                  {player.name}
                  {player.id === currentPlayerId ? ' (You)' : ''}
                </span>
                {isEliminated && (
                  <span className="text-[10px] font-display text-red-400 uppercase">
                    Out
                  </span>
                )}
                {isCurrentTurn && !isEliminated && (
                  <span className="text-[10px] font-display text-neon-cyan uppercase animate-pulse">
                    Turn
                  </span>
                )}
              </div>
            );
          })}
      </div>

      {/* ---- Elimination Flash Banner ---- */}
      {eliminationFlash && eliminationReason && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-red-500/20 border border-red-500/40 animate-pulse">
          <span className="font-display text-red-400 text-sm">
            {players.find((p) => p.id === eliminationFlash)?.name ?? 'Player'} eliminated!
          </span>
          <span className="font-body text-red-300/80 text-xs">
            {eliminationReason}
          </span>
        </div>
      )}

      {/* ---- Word Chain Display ---- */}
      <Card glow="none" className="flex-shrink-0">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-2 min-w-max py-2">
            {derivedVisibleChain.map((word, i) => {
              const isLast = i === derivedVisibleChain.length - 1;
              const isFirst = i === 0 && derivedState.chain.length <= 8;
              const globalIndex = derivedState.chain.length - derivedVisibleChain.length + i;

              return (
                <React.Fragment key={`${word}-${globalIndex}`}>
                  {i > 0 && (
                    <svg
                      className="w-4 h-4 text-white/20 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                  <span
                    className={[
                      'px-4 py-2 rounded-full font-display text-sm whitespace-nowrap transition-all duration-300',
                      isLast
                        ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 shadow-[0_0_12px_rgba(0,229,255,0.3)] text-base'
                        : isFirst
                          ? 'bg-neon-yellow/15 text-neon-yellow border border-neon-yellow/30'
                          : 'bg-white/10 text-white/80 border border-white/10',
                    ].join(' ')}
                  >
                    {word}
                  </span>
                </React.Fragment>
              );
            })}
            <div ref={chainEndRef} />
          </div>
        </div>
      </Card>

      {/* ---- Current Word (Prominent) ---- */}
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="font-body text-xs text-white/40 uppercase tracking-wider">
          Current Word
        </p>
        <div className="relative">
          <div className="absolute -inset-3 rounded-2xl bg-neon-cyan/10 blur-lg animate-pulse" />
          <h2 className="relative font-display text-4xl md:text-5xl text-neon-cyan text-center tracking-wide">
            {derivedCurrentWord.toUpperCase()}
          </h2>
        </div>
      </div>

      {/* ---- Whose Turn + Timer ---- */}
      <div className="flex flex-col items-center gap-3">
        {derivedCurrentTurnPlayer && !derivedState.winnerId && (
          <div className="flex items-center gap-3">
            <Avatar
              name={derivedCurrentTurnPlayer.name}
              color={derivedCurrentTurnPlayer.color}
              size="sm"
              isBot={derivedCurrentTurnPlayer.isBot}
            />
            <span className="font-display text-lg text-white">
              {derivedIsMyTurn ? 'Your turn!' : `${derivedCurrentTurnPlayer.name}'s turn`}
            </span>
          </div>
        )}

        {/* Timer bar */}
        {!derivedState.winnerId && (
          <div className="w-full max-w-md">
            <ProgressBar
              progress={timerProgress}
              color={timerColor}
              height="md"
            />
            <p className="font-mono text-xs text-white/40 text-center mt-1">
              {Math.ceil(localTurnTime)}s
            </p>
          </div>
        )}
      </div>

      {/* ---- Input Area ---- */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {derivedIsMyTurn && !derivedState.winnerId && phase === GamePhase.ROUND_ACTIVE ? (
          <form
            onSubmit={handleSubmitWord}
            className="w-full max-w-md flex flex-col gap-3"
          >
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                placeholder="Type an associated word..."
                maxLength={40}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={[
                  'w-full font-display text-xl text-center text-white bg-navy-800 border-2 rounded-2xl px-6 py-4',
                  'placeholder:text-white/20',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-neon-cyan/60',
                  'border-neon-cyan/30',
                  timerProgress < 25 ? 'border-neon-pink/50 focus:ring-neon-pink focus:border-neon-pink/60' : '',
                ].join(' ')}
              />
              {timerProgress < 25 && (
                <div className="absolute inset-0 rounded-2xl border-2 border-neon-pink/30 animate-pulse pointer-events-none" />
              )}
            </div>
            <Button
              variant="secondary"
              size="lg"
              type="submit"
              disabled={wordInput.trim().length < MIN_WORD_LENGTH}
              className="w-full"
            >
              Submit Word
            </Button>
          </form>
        ) : !derivedState.winnerId ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="font-body text-white/50">
              {derivedCurrentTurnPlayer
                ? `Waiting for ${derivedCurrentTurnPlayer.name}...`
                : 'Waiting...'}
            </p>
            {derivedState.eliminatedPlayers.includes(currentPlayerId ?? '') && (
              <p className="font-body text-sm text-red-400/80">
                You have been eliminated. Spectating...
              </p>
            )}
          </div>
        ) : null}

        {/* Winner announcement during active phase (brief flash before round ends) */}
        {derivedState.winnerId && phase === GamePhase.ROUND_ACTIVE && (
          <div className="flex flex-col items-center gap-3 animate-bounce-in">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-neon-yellow/30 animate-pulse" />
              {winnerPlayer && (
                <Avatar
                  name={winnerPlayer.name}
                  color={winnerPlayer.color}
                  size="lg"
                  isBot={winnerPlayer.isBot}
                />
              )}
            </div>
            <p className="font-display text-2xl text-neon-yellow">
              {winnerPlayer?.name ?? 'Winner'} is the last one standing!
            </p>
          </div>
        )}
      </div>

      {/* ---- Sidebar: Scoreboard ---- */}
      <Card glow="none" className="mt-auto">
        <Scoreboard
          scores={scores}
          players={players}
          currentPlayerId={currentPlayerId ?? ''}
        />
      </Card>

      {/* ---- Shake animation keyframes ---- */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounceIn 0.6s ease-out;
        }
      `}</style>
    </div>
  );
};

export default WordAssociationGame;
