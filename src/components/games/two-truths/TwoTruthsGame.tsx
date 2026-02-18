import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase, Player } from '../../../types';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { useTransportContext } from '../../../context/TransportContext';
import { shuffle } from '../../../lib/utils/shuffle';
import { sanitizeStatement } from '../../../lib/security/sanitize';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Input from '../../ui/Input';
import Timer from '../../ui/Timer';
import Avatar from '../../ui/Avatar';
import Badge from '../../ui/Badge';
import Scoreboard from '../../game/Scoreboard';
import RoundTransition from '../../game/RoundTransition';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TwoTruthsPhase = 'submitting' | 'voting' | 'revealing';

interface TwoTruthsRoundData {
  storytellerId: string;
  playerOrder: string[];
  currentStorytellerIndex: number;
  phase: TwoTruthsPhase;
  statements: string[];
  lieIndex: number;
  votes: Record<string, number>;
  revealed: boolean;
  actions?: Array<{
    playerId: string;
    action: { type: string; [key: string]: unknown };
    timestamp: number;
  }>;
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

// ---------------------------------------------------------------------------
// Statement Card Colors
// ---------------------------------------------------------------------------

const STATEMENT_COLORS = [
  {
    base: 'bg-indigo-600/30 border-indigo-400/30 hover:border-indigo-400/60 hover:bg-indigo-600/40',
    selected: 'bg-indigo-600/50 border-indigo-400/60 ring-2 ring-indigo-300',
    truth: 'bg-emerald-600/30 border-emerald-400/60',
    lie: 'bg-rose-600/30 border-rose-400/60',
  },
  {
    base: 'bg-violet-600/30 border-violet-400/30 hover:border-violet-400/60 hover:bg-violet-600/40',
    selected: 'bg-violet-600/50 border-violet-400/60 ring-2 ring-violet-300',
    truth: 'bg-emerald-600/30 border-emerald-400/60',
    lie: 'bg-rose-600/30 border-rose-400/60',
  },
  {
    base: 'bg-sky-600/30 border-sky-400/30 hover:border-sky-400/60 hover:bg-sky-600/40',
    selected: 'bg-sky-600/50 border-sky-400/60 ring-2 ring-sky-300',
    truth: 'bg-emerald-600/30 border-emerald-400/60',
    lie: 'bg-rose-600/30 border-rose-400/60',
  },
];

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

function calculateRoundScores(
  data: TwoTruthsRoundData,
  allPlayers: Player[],
): Record<string, number> {
  const roundScores: Record<string, number> = {};

  for (const p of allPlayers) {
    roundScores[p.id] = 0;
  }

  let fooledCount = 0;

  for (const [playerId, voteIdx] of Object.entries(data.votes)) {
    if (playerId === data.storytellerId) continue;

    if (voteIdx === data.lieIndex) {
      // Correct: player identified the lie
      roundScores[playerId] = 200;
    } else {
      // Fooled by the storyteller
      fooledCount++;
    }
  }

  // Storyteller gets 100 per player fooled
  roundScores[data.storytellerId] = fooledCount * 100;

  return roundScores;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TwoTruthsGame: React.FC = () => {
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

  const totalTime = config.timeLimit;
  const rd = roundData as TwoTruthsRoundData | null;

  // Local form state for storyteller's submissions
  const [statement1, setStatement1] = useState('');
  const [statement2, setStatement2] = useState('');
  const [statement3, setStatement3] = useState('');
  const [selectedLie, setSelectedLie] = useState<number>(-1);
  const [formError, setFormError] = useState('');

  // Local voting state
  const [myVote, setMyVote] = useState<number | null>(null);

  // Round transition
  const [showTransition, setShowTransition] = useState(false);

  // Track processed actions to avoid duplicate processing
  const processedActionsRef = useRef<number>(0);

  // Track player order across rounds
  const playerOrderRef = useRef<string[]>([]);

  // Reveal animation state
  const [revealStep, setRevealStep] = useState<number>(0);

  // Track whether we already ended this round
  const roundEndedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // GAME_STARTING: Host sets up player order and first round
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.GAME_STARTING) return;

    const connectedPlayers = players.filter((p) => p.connected);
    if (connectedPlayers.length < 2) return;

    const order = shuffle(connectedPlayers.map((p) => p.id));
    playerOrderRef.current = order;

    // Small delay before starting first round
    const timer = setTimeout(() => {
      const firstStoryteller = order[0];

      const newRoundData: TwoTruthsRoundData = {
        storytellerId: firstStoryteller,
        playerOrder: order,
        currentStorytellerIndex: 0,
        phase: 'submitting',
        statements: [],
        lieIndex: -1,
        votes: {},
        revealed: false,
      };

      roundEndedRef.current = false;

      dispatch({ type: 'START_ROUND', roundData: newRoundData });

      transport?.send({
        type: 'ROUND_START',
        payload: { round: 1, data: newRoundData },
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [isHost, phase, players, dispatch, transport]);

  // ---------------------------------------------------------------------------
  // Reset local state when round changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) {
      setStatement1('');
      setStatement2('');
      setStatement3('');
      setSelectedLie(-1);
      setFormError('');
      setMyVote(null);
      processedActionsRef.current = 0;
      setRevealStep(0);
      roundEndedRef.current = false;
    }
  }, [phase, currentRound]);

  // ---------------------------------------------------------------------------
  // Sync playerOrder ref from round data
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (rd?.playerOrder && rd.playerOrder.length > 0) {
      playerOrderRef.current = rd.playerOrder;
    }
  }, [rd?.playerOrder]);

  // ---------------------------------------------------------------------------
  // Derive the effective round state from actions (works on both host and client)
  // ---------------------------------------------------------------------------
  const effectiveRd = useMemo((): TwoTruthsRoundData | null => {
    if (!rd) return null;

    // Start with the base round data (which includes host-synced values)
    const derived: TwoTruthsRoundData = {
      storytellerId: rd.storytellerId,
      playerOrder: rd.playerOrder,
      currentStorytellerIndex: rd.currentStorytellerIndex,
      phase: rd.phase,
      statements: [...rd.statements],
      lieIndex: rd.lieIndex,
      votes: { ...rd.votes },
      revealed: rd.revealed,
    };

    // Process actions to derive the latest state
    if (rd.actions && derived.phase === 'submitting' && derived.statements.length === 0) {
      for (const entry of rd.actions) {
        const { playerId, action } = entry;

        if (
          action.type === 'submit_statements' &&
          playerId === rd.storytellerId
        ) {
          const rawStatements = action.statements as string[];
          const rawLieIndex = action.lieIndex as number;
          const sanitized = rawStatements.map((s) => sanitizeStatement(String(s)));

          // Non-host will get the shuffled version from GAME_STATE_SYNC.
          // For display purposes before sync arrives, show unshuffled.
          derived.statements = sanitized;
          derived.lieIndex = rawLieIndex;
          derived.phase = 'voting';
          break;
        }
      }
    }

    // Process votes from actions if not already in derived.votes
    if (rd.actions) {
      for (const entry of rd.actions) {
        const { playerId, action } = entry;
        if (
          action.type === 'vote' &&
          playerId !== derived.storytellerId &&
          derived.votes[playerId] === undefined
        ) {
          const voteIndex = action.voteIndex as number;
          if (voteIndex >= 0 && voteIndex < 3) {
            derived.votes[playerId] = voteIndex;
          }
        }
      }
    }

    return derived;
  }, [rd]);

  // ---------------------------------------------------------------------------
  // Host: process incoming actions
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!rd || !rd.actions) return;

    const actions = rd.actions;
    const startIdx = processedActionsRef.current;
    if (actions.length <= startIdx) return;

    let needsUpdate = false;
    let updatedStatements = [...rd.statements];
    let updatedLieIndex = rd.lieIndex;
    let updatedPhase: TwoTruthsPhase = rd.phase;
    let updatedVotes = { ...rd.votes };
    let updatedRevealed = rd.revealed;

    for (let i = startIdx; i < actions.length; i++) {
      const entry = actions[i];
      const { playerId, action } = entry;

      // Handle statement submission from storyteller
      if (
        action.type === 'submit_statements' &&
        playerId === rd.storytellerId &&
        updatedPhase === 'submitting' &&
        updatedStatements.length === 0
      ) {
        const rawStatements = action.statements as string[];
        const rawLieIndex = action.lieIndex as number;
        const sanitized = rawStatements.map((s) => sanitizeStatement(String(s)));

        // Shuffle the statements, adjusting lie index accordingly
        const indices = shuffle([0, 1, 2]);
        updatedStatements = indices.map((idx) => sanitized[idx]);
        updatedLieIndex = indices.indexOf(rawLieIndex);
        updatedPhase = 'voting';
        needsUpdate = true;
      }

      // Handle votes from non-storyteller players
      if (
        action.type === 'vote' &&
        playerId !== rd.storytellerId &&
        updatedVotes[playerId] === undefined
      ) {
        const voteIndex = action.voteIndex as number;
        if (voteIndex >= 0 && voteIndex < 3) {
          updatedVotes[playerId] = voteIndex;
          needsUpdate = true;
        }
      }
    }

    processedActionsRef.current = actions.length;

    if (!needsUpdate) return;

    // Check if all non-storyteller players have voted
    if (updatedPhase === 'voting' && updatedStatements.length > 0) {
      const nonStorytellers = players.filter(
        (p) => p.connected && p.id !== rd.storytellerId,
      );
      const allVoted = nonStorytellers.every(
        (p) => updatedVotes[p.id] !== undefined,
      );

      if (allVoted && nonStorytellers.length > 0 && !roundEndedRef.current) {
        updatedPhase = 'revealing';
        updatedRevealed = true;

        const updatedRd: TwoTruthsRoundData = {
          ...rd,
          phase: updatedPhase,
          statements: updatedStatements,
          lieIndex: updatedLieIndex,
          votes: updatedVotes,
          revealed: updatedRevealed,
        };

        const roundScores = calculateRoundScores(updatedRd, players);
        roundEndedRef.current = true;

        dispatch({
          type: 'END_ROUND',
          scores: roundScores,
          roundData: updatedRd,
        });

        transport?.send({
          type: 'ROUND_END',
          payload: { scores: roundScores, roundData: updatedRd },
        });
        return;
      }
    }

    // For intermediate updates (submitting -> voting), broadcast via state sync.
    // The periodic GAME_STATE_SYNC will pick up the updated roundData if we
    // dispatch it. We use a workaround: directly broadcast updated roundData.
    if (updatedPhase === 'voting' && rd.phase === 'submitting') {
      // We need to get the updated roundData into engineState.
      // The engine doesn't have an UPDATE_ROUND_DATA action, but the
      // GAME_STATE_SYNC broadcasts engineState.roundData every second.
      // We can broadcast the updated roundData immediately via transport.
      const updatedRd: TwoTruthsRoundData = {
        ...rd,
        phase: updatedPhase,
        statements: updatedStatements,
        lieIndex: updatedLieIndex,
        votes: updatedVotes,
        revealed: updatedRevealed,
      };

      // Dispatch END_ROUND with 0 scores to update roundData without ending game,
      // then immediately start a new round with the updated data.
      // Actually, let's just use GAME_STATE_SYNC broadcast directly.
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
  }, [isHost, phase, rd?.actions?.length, rd?.phase, rd?.storytellerId, players, dispatch, transport, engineState]);

  // ---------------------------------------------------------------------------
  // Host: handle timer expiration during voting - force reveal
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING) return;
    if (!rd) return;
    if (rd.revealed || roundEndedRef.current) return;

    // Timer expired while in submitting or voting phase
    // If still submitting, just move on with no scores
    if (rd.phase === 'submitting' || (rd.statements.length === 0)) {
      const emptyScores: Record<string, number> = {};
      for (const p of players) {
        emptyScores[p.id] = 0;
      }

      const updatedRd: TwoTruthsRoundData = {
        ...rd,
        phase: 'revealing',
        revealed: true,
      };

      roundEndedRef.current = true;

      dispatch({
        type: 'END_ROUND',
        scores: emptyScores,
        roundData: updatedRd,
      });

      transport?.send({
        type: 'ROUND_END',
        payload: { scores: emptyScores, roundData: updatedRd },
      });
      return;
    }

    // Timer expired during voting - force reveal with whatever votes we have
    let updatedVotes = { ...rd.votes };
    if (rd.actions) {
      for (const entry of rd.actions) {
        if (
          entry.action.type === 'vote' &&
          entry.playerId !== rd.storytellerId &&
          updatedVotes[entry.playerId] === undefined
        ) {
          const voteIndex = entry.action.voteIndex as number;
          if (voteIndex >= 0 && voteIndex < 3) {
            updatedVotes[entry.playerId] = voteIndex;
          }
        }
      }
    }

    const updatedRd: TwoTruthsRoundData = {
      ...rd,
      phase: 'revealing',
      revealed: true,
      votes: updatedVotes,
    };

    const roundScores = calculateRoundScores(updatedRd, players);
    roundEndedRef.current = true;

    dispatch({
      type: 'END_ROUND',
      scores: roundScores,
      roundData: updatedRd,
    });

    transport?.send({
      type: 'ROUND_END',
      payload: { scores: roundScores, roundData: updatedRd },
    });
  }, [isHost, phase, rd?.revealed, rd?.phase, players, dispatch, transport]);

  // ---------------------------------------------------------------------------
  // Reveal animation: step through statements one by one
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const erd = effectiveRd;
    if (!erd) return;
    if (erd.phase !== 'revealing' && !erd.revealed) return;
    if (rd?.phase !== 'revealing' && !rd?.revealed) return;
    if (revealStep >= 3) return;

    const timer = setTimeout(() => {
      setRevealStep((prev) => prev + 1);
    }, 1200);

    return () => clearTimeout(timer);
  }, [effectiveRd?.phase, effectiveRd?.revealed, rd?.phase, rd?.revealed, revealStep]);

  // ---------------------------------------------------------------------------
  // Host: after revealing, wait 5 seconds then move to next round or end game
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING && phase !== GamePhase.GAME_ENDING) return;
    if (!rd?.revealed) return;

    const timer = setTimeout(() => {
      const order = playerOrderRef.current;
      const nextIndex = (rd.currentStorytellerIndex ?? 0) + 1;

      if (currentRound >= totalRounds || nextIndex >= order.length) {
        endGame();
      } else {
        setShowTransition(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isHost, phase, rd?.revealed, currentRound, totalRounds, endGame]);

  // ---------------------------------------------------------------------------
  // Round transition complete -> start next round
  // ---------------------------------------------------------------------------
  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);

    if (!isHost) return;

    const order = playerOrderRef.current;
    const nextIndex = (rd?.currentStorytellerIndex ?? 0) + 1;

    if (nextIndex >= order.length) {
      endGame();
      return;
    }

    const nextStoryteller = order[nextIndex];

    const newRoundData: TwoTruthsRoundData = {
      storytellerId: nextStoryteller,
      playerOrder: order,
      currentStorytellerIndex: nextIndex,
      phase: 'submitting',
      statements: [],
      lieIndex: -1,
      votes: {},
      revealed: false,
    };

    roundEndedRef.current = false;

    dispatch({ type: 'START_ROUND', roundData: newRoundData });

    transport?.send({
      type: 'ROUND_START',
      payload: { round: currentRound + 1, data: newRoundData },
    });
  }, [isHost, rd?.currentStorytellerIndex, currentRound, dispatch, transport, endGame]);

  // ---------------------------------------------------------------------------
  // Storyteller: submit statements
  // ---------------------------------------------------------------------------
  const handleSubmitStatements = useCallback(() => {
    const s1 = sanitizeStatement(statement1);
    const s2 = sanitizeStatement(statement2);
    const s3 = sanitizeStatement(statement3);

    if (!s1 || !s2 || !s3) {
      setFormError('Please fill in all three statements.');
      return;
    }

    if (selectedLie < 0 || selectedLie > 2) {
      setFormError('Please select which statement is the lie.');
      return;
    }

    setFormError('');
    playerAction({
      type: 'submit_statements',
      statements: [s1, s2, s3],
      lieIndex: selectedLie,
    });
  }, [statement1, statement2, statement3, selectedLie, playerAction]);

  // ---------------------------------------------------------------------------
  // Voter: submit vote
  // ---------------------------------------------------------------------------
  const handleVote = useCallback(
    (index: number) => {
      if (myVote !== null) return;
      setMyVote(index);
      playerAction({ type: 'vote', voteIndex: index });
    },
    [myVote, playerAction],
  );

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------
  const erd = effectiveRd;
  const storyteller = erd ? getPlayer(players, erd.storytellerId) : null;
  const isStoryteller = currentPlayerId === erd?.storytellerId;

  // Use rd for authoritative state (host syncs this), fall back to effectiveRd
  const displayRd = rd && rd.statements.length > 0 ? rd : erd;

  const displayPhase: TwoTruthsPhase = displayRd?.phase ?? 'submitting';
  const displayStatements = displayRd?.statements ?? [];
  const displayLieIndex = displayRd?.lieIndex ?? -1;
  const displayVotes = displayRd?.votes ?? {};
  const displayRevealed = displayRd?.revealed ?? false;

  const voteCount = Object.keys(displayVotes).length;
  const totalVoters = erd
    ? players.filter((p) => p.connected && p.id !== erd.storytellerId).length
    : 0;

  // Compute round scores for reveal display
  const roundScores = useMemo(() => {
    if (!displayRd || !displayRevealed || displayStatements.length === 0) return {};
    return calculateRoundScores(
      {
        ...displayRd,
        votes: displayVotes,
        lieIndex: displayLieIndex,
      },
      players,
    );
  }, [displayRd, displayRevealed, displayStatements, displayVotes, displayLieIndex, players]);

  // Vote distribution per statement
  const voteDistribution = useMemo(() => {
    const dist: string[][] = [[], [], []];
    for (const [pid, idx] of Object.entries(displayVotes)) {
      if (idx >= 0 && idx < 3) {
        const pName = getPlayerName(players, pid);
        dist[idx].push(pName);
      }
    }
    return dist;
  }, [displayVotes, players]);

  // ---------------------------------------------------------------------------
  // Render: Loading / Starting
  // ---------------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">
            Setting up Two Truths &amp; A Lie...
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
  if (!erd) {
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
    const nextIdx = (erd.currentStorytellerIndex ?? 0) + 1;
    const nextPlayerId = playerOrderRef.current[nextIdx] ?? '';
    const nextName = getPlayerName(players, nextPlayerId);

    return (
      <RoundTransition
        round={currentRound + 1}
        totalRounds={totalRounds}
        message={`${nextName}'s turn to tell!`}
        onComplete={handleTransitionComplete}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Determine if this is the reveal phase
  // ---------------------------------------------------------------------------
  const isReveal = displayRevealed && displayStatements.length > 0;

  // ---------------------------------------------------------------------------
  // Main Layout
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen p-4 flex gap-4">
      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 max-w-3xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg text-white/60">
              Round {currentRound}/{totalRounds}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-body border bg-purple-500/20 text-purple-300 border-purple-400/30">
              Two Truths &amp; A Lie
            </span>
          </div>
          {phase === GamePhase.ROUND_ACTIVE && displayPhase === 'voting' && (
            <Timer
              timeRemaining={timeRemaining}
              totalTime={totalTime}
              size="md"
              showSeconds
            />
          )}
        </div>

        {/* Storyteller highlight */}
        {storyteller && (
          <Card
            glow={isStoryteller ? 'yellow' : 'cyan'}
            className="flex items-center gap-4"
          >
            <Avatar
              name={storyteller.name}
              color={storyteller.color}
              size="lg"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-xl text-white">
                  {storyteller.name}
                  {isStoryteller && (
                    <span className="text-neon-yellow ml-2">(You)</span>
                  )}
                </span>
                <Badge variant="host">STORYTELLER</Badge>
              </div>
              <p className="font-body text-sm text-white/50 mt-1">
                {displayPhase === 'submitting'
                  ? 'Writing their statements...'
                  : displayPhase === 'voting'
                    ? 'Which one is the lie?'
                    : 'The truth is revealed!'}
              </p>
            </div>
          </Card>
        )}

        {/* ===== SUBMITTING PHASE ===== */}
        {displayPhase === 'submitting' && isStoryteller && (
          <Card glow="yellow" className="flex flex-col gap-5">
            <div className="text-center">
              <h2 className="font-display text-2xl text-neon-yellow">
                Write Your Statements
              </h2>
              <p className="font-body text-sm text-white/50 mt-2">
                Enter 2 truths and 1 lie about yourself. Then select which one
                is the lie.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Statement 1 */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLie(0)}
                  className={[
                    'shrink-0 mt-2 w-8 h-8 rounded-full border-2 flex items-center justify-center font-display text-sm transition-all duration-200',
                    selectedLie === 0
                      ? 'bg-rose-500 border-rose-400 text-white scale-110'
                      : 'bg-transparent border-white/20 text-white/40 hover:border-white/40',
                  ].join(' ')}
                  title="Mark as the lie"
                >
                  {selectedLie === 0 ? 'L' : '1'}
                </button>
                <div className="flex-1">
                  <Input
                    placeholder="Statement #1"
                    value={statement1}
                    onChange={(e) => setStatement1(e.target.value)}
                    maxLength={300}
                  />
                </div>
              </div>

              {/* Statement 2 */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLie(1)}
                  className={[
                    'shrink-0 mt-2 w-8 h-8 rounded-full border-2 flex items-center justify-center font-display text-sm transition-all duration-200',
                    selectedLie === 1
                      ? 'bg-rose-500 border-rose-400 text-white scale-110'
                      : 'bg-transparent border-white/20 text-white/40 hover:border-white/40',
                  ].join(' ')}
                  title="Mark as the lie"
                >
                  {selectedLie === 1 ? 'L' : '2'}
                </button>
                <div className="flex-1">
                  <Input
                    placeholder="Statement #2"
                    value={statement2}
                    onChange={(e) => setStatement2(e.target.value)}
                    maxLength={300}
                  />
                </div>
              </div>

              {/* Statement 3 */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLie(2)}
                  className={[
                    'shrink-0 mt-2 w-8 h-8 rounded-full border-2 flex items-center justify-center font-display text-sm transition-all duration-200',
                    selectedLie === 2
                      ? 'bg-rose-500 border-rose-400 text-white scale-110'
                      : 'bg-transparent border-white/20 text-white/40 hover:border-white/40',
                  ].join(' ')}
                  title="Mark as the lie"
                >
                  {selectedLie === 2 ? 'L' : '3'}
                </button>
                <div className="flex-1">
                  <Input
                    placeholder="Statement #3"
                    value={statement3}
                    onChange={(e) => setStatement3(e.target.value)}
                    maxLength={300}
                  />
                </div>
              </div>
            </div>

            {selectedLie >= 0 && (
              <p className="font-body text-xs text-rose-400 text-center">
                Statement #{selectedLie + 1} is marked as the lie
              </p>
            )}

            {formError && (
              <p className="font-body text-sm text-neon-pink text-center">
                {formError}
              </p>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={handleSubmitStatements}
              className="w-full"
            >
              Submit Statements
            </Button>
          </Card>
        )}

        {displayPhase === 'submitting' && !isStoryteller && (
          <Card className="text-center py-12">
            <div className="w-12 h-12 border-4 border-neon-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-display text-xl text-white/70">
              Waiting for{' '}
              <span className="text-neon-yellow">
                {storyteller?.name ?? 'storyteller'}
              </span>{' '}
              to write their statements...
            </p>
            <p className="font-body text-sm text-white/40 mt-2">
              Get ready to spot the lie!
            </p>
          </Card>
        )}

        {/* ===== VOTING PHASE ===== */}
        {displayPhase === 'voting' && displayStatements.length > 0 && !isReveal && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <h2 className="font-display text-2xl text-neon-cyan">
                {isStoryteller
                  ? 'Players are guessing...'
                  : 'Which one is the LIE?'}
              </h2>
              <p className="font-body text-sm text-white/50 mt-1">
                {isStoryteller
                  ? `${voteCount}/${totalVoters} votes in`
                  : 'Click on the statement you think is false'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {displayStatements.map((statement, idx) => {
                const color = STATEMENT_COLORS[idx];
                const isVoted = myVote === idx;
                const canVote =
                  !isStoryteller &&
                  myVote === null &&
                  phase === GamePhase.ROUND_ACTIVE;

                return (
                  <button
                    key={idx}
                    disabled={!canVote}
                    onClick={() => handleVote(idx)}
                    className={[
                      'relative flex items-center gap-4 p-6 rounded-2xl border text-left',
                      'transition-all duration-300 ease-out',
                      'disabled:cursor-default',
                      canVote &&
                        'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                      isVoted ? color.selected : color.base,
                      isStoryteller && 'opacity-80',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {/* Number badge */}
                    <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-black/20 flex items-center justify-center font-display text-2xl text-white">
                      {idx + 1}
                    </span>

                    {/* Statement text */}
                    <span className="font-body text-lg text-white flex-1 leading-relaxed">
                      {statement}
                    </span>

                    {/* Vote indicator */}
                    {isVoted && (
                      <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-white/20 text-xs font-display text-white">
                        YOUR VOTE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Vote progress */}
            {!isStoryteller && myVote !== null && (
              <div className="text-center py-2">
                <span className="font-display text-lg text-neon-cyan animate-pulse">
                  Vote locked! Waiting for others... ({voteCount}/{totalVoters})
                </span>
              </div>
            )}

            {isStoryteller && (
              <div className="text-center py-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                  <span className="font-body text-sm text-white/60">
                    Votes received:
                  </span>
                  <span className="font-display text-lg text-neon-yellow">
                    {voteCount}/{totalVoters}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== REVEALING PHASE ===== */}
        {isReveal && displayStatements.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="text-center mb-2">
              <h2 className="font-display text-3xl text-neon-yellow">
                The Truth Revealed!
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              {displayStatements.map((statement, idx) => {
                const isLie = idx === displayLieIndex;
                const isRevealed = revealStep > idx;
                const color = STATEMENT_COLORS[idx];
                const voters = voteDistribution[idx];

                return (
                  <div
                    key={idx}
                    className={[
                      'relative flex flex-col gap-2 p-6 rounded-2xl border text-left',
                      'transition-all duration-700 ease-out',
                      isRevealed
                        ? isLie
                          ? color.lie
                          : color.truth
                        : 'bg-white/5 border-white/10',
                      !isRevealed && 'opacity-40',
                    ].join(' ')}
                    style={{
                      transform: isRevealed ? 'rotateX(0deg)' : 'rotateX(90deg)',
                      transformOrigin: 'top center',
                      transition:
                        'transform 0.6s ease-out, opacity 0.4s ease-out, background-color 0.4s ease-out, border-color 0.4s ease-out',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Number */}
                      <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-black/20 flex items-center justify-center font-display text-2xl text-white">
                        {idx + 1}
                      </span>

                      {/* Statement */}
                      <span className="font-body text-lg text-white flex-1 leading-relaxed">
                        {statement}
                      </span>

                      {/* Truth/Lie badge */}
                      {isRevealed && (
                        <span
                          className={[
                            'shrink-0 px-4 py-1.5 rounded-full font-display text-sm border',
                            isLie
                              ? 'bg-rose-500/30 border-rose-400/50 text-rose-300'
                              : 'bg-emerald-500/30 border-emerald-400/50 text-emerald-300',
                          ].join(' ')}
                          style={{
                            animation: isRevealed
                              ? 'ttBadgePop 0.4s ease-out'
                              : 'none',
                          }}
                        >
                          {isLie ? 'LIE!' : 'TRUTH'}
                        </span>
                      )}
                    </div>

                    {/* Voters for this statement */}
                    {isRevealed && voters.length > 0 && (
                      <div className="ml-16 flex flex-wrap gap-1.5 mt-1">
                        {voters.map((name, vi) => (
                          <span
                            key={vi}
                            className={[
                              'px-2 py-0.5 rounded-full text-xs font-body border',
                              isLie
                                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                                : 'bg-rose-500/10 border-rose-400/30 text-rose-300',
                            ].join(' ')}
                          >
                            {name} {isLie ? '\u2713' : '\u2717'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Round scores */}
            {revealStep >= 3 && (
              <Card className="mt-2 animate-fade-in">
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
                      const isStory = player.id === erd?.storytellerId;
                      const votedCorrectly =
                        !isStory &&
                        displayVotes[player.id] === displayLieIndex;

                      return (
                        <div
                          key={player.id}
                          className={[
                            'flex items-center justify-between px-4 py-2 rounded-lg',
                            isStory
                              ? 'bg-neon-yellow/10'
                              : votedCorrectly
                                ? 'bg-emerald-500/10'
                                : 'bg-rose-500/10',
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
                                <span className="text-white/40 ml-1">
                                  (You)
                                </span>
                              )}
                            </span>
                            {isStory && (
                              <Badge variant="host">STORYTELLER</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isStory && (
                              <span
                                className={[
                                  'text-xs font-body',
                                  votedCorrectly
                                    ? 'text-emerald-400'
                                    : displayVotes[player.id] !== undefined
                                      ? 'text-rose-400'
                                      : 'text-white/40',
                                ].join(' ')}
                              >
                                {votedCorrectly
                                  ? 'Spotted the lie!'
                                  : displayVotes[player.id] !== undefined
                                    ? 'Fooled!'
                                    : 'No vote'}
                              </span>
                            )}
                            {isStory && (
                              <span className="text-xs font-body text-neon-yellow">
                                Fooled{' '}
                                {
                                  Object.entries(displayVotes).filter(
                                    ([pid, v]) =>
                                      pid !== erd?.storytellerId &&
                                      v !== displayLieIndex,
                                  ).length
                                }{' '}
                                player(s)
                              </span>
                            )}
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
                        </div>
                      );
                    })}
                </div>
              </Card>
            )}
          </div>
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

      {/* Inline keyframes */}
      <style>{`
        @keyframes ttBadgePop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TwoTruthsGame;
