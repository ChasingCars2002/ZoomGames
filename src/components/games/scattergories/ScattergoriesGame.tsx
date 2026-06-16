import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase, Player } from '../../../types';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { useTransportContext } from '../../../context/TransportContext';
import { shuffle } from '../../../lib/utils/shuffle';
import { sanitizeMessage } from '../../../lib/security/sanitize';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Scoreboard from '../../game/Scoreboard';
import { SCATTER_CATEGORIES } from './ScattergoriesData';
import {
  LETTER_POOL,
  deriveSubmissions,
  tallyScattergories,
  ScatterTally,
  ScatterActionEntry,
} from './scattergoriesLogic';

const CATEGORIES_PER_ROUND = 6;

interface ScattergoriesRoundData {
  letter: string;
  categories: string[];
  revealed: boolean;
  tally?: ScatterTally;
  actions?: ScatterActionEntry[];
}

const ScattergoriesGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();
  const { transport } = useTransportContext();

  const { phase, players, scores, currentRound, totalRounds, roundData } = engineState;
  const rd = roundData as ScattergoriesRoundData | null;
  const hasRound = Boolean(rd && rd.letter && Array.isArray(rd.categories));

  const roundEndedRef = useRef(false);
  const usedCategoriesRef = useRef<Set<string>>(new Set());

  const [answers, setAnswers] = useState<string[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const submissions = useMemo(
    () => (hasRound ? deriveSubmissions(rd!.actions) : {}),
    [rd?.actions, hasRound],
  );

  const connectedPlayers = useMemo(() => players.filter((p) => p.connected), [players]);
  const submittedCount = useMemo(
    () => connectedPlayers.filter((p) => submissions[p.id]).length,
    [connectedPlayers, submissions],
  );

  // -----------------------------------------------------------------------
  // Host: start a round
  // -----------------------------------------------------------------------
  const startNextRound = useCallback(() => {
    if (!isHost) return;

    const letter = LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];

    let pool = SCATTER_CATEGORIES.filter((c) => !usedCategoriesRef.current.has(c));
    if (pool.length < CATEGORIES_PER_ROUND) {
      usedCategoriesRef.current.clear();
      pool = [...SCATTER_CATEGORIES];
    }
    const categories = shuffle(pool).slice(0, CATEGORIES_PER_ROUND);
    categories.forEach((c) => usedCategoriesRef.current.add(c));

    const newRoundData: ScattergoriesRoundData = { letter, categories, revealed: false };
    roundEndedRef.current = false;
    dispatch({ type: 'START_ROUND', roundData: newRoundData });
    transport?.send({ type: 'ROUND_START', payload: { round: currentRound + 1, data: newRoundData } });
  }, [isHost, dispatch, transport, currentRound]);

  useEffect(() => {
    if (!isHost || phase !== GamePhase.GAME_STARTING) return;
    const t = setTimeout(startNextRound, 500);
    return () => clearTimeout(t);
  }, [isHost, phase, startNextRound]);

  // Reset local state each new round
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE && hasRound) {
      setAnswers(Array(rd!.categories.length).fill(''));
      setHasSubmitted(false);
      roundEndedRef.current = false;
    }
  }, [phase, currentRound, hasRound]);

  // -----------------------------------------------------------------------
  // Host: resolve the round
  // -----------------------------------------------------------------------
  const finishRound = useCallback(() => {
    if (!isHost || !rd || roundEndedRef.current) return;
    roundEndedRef.current = true;

    const tally = tallyScattergories(submissions, rd.letter, rd.categories, players);
    const finalRd: ScattergoriesRoundData = { ...rd, revealed: true, tally };
    dispatch({ type: 'END_ROUND', scores: tally.scores, roundData: finalRd });
    transport?.send({ type: 'ROUND_END', payload: { scores: tally.scores, roundData: finalRd } });
  }, [isHost, rd, submissions, players, dispatch, transport]);

  // All connected players locked in → resolve early
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ACTIVE || !hasRound) return;
    if (connectedPlayers.length > 0 && submittedCount >= connectedPlayers.length) {
      finishRound();
    }
  }, [isHost, phase, hasRound, connectedPlayers.length, submittedCount, finishRound]);

  // Timer expired
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ENDING || roundEndedRef.current) return;
    finishRound();
  }, [isHost, phase, finishRound]);

  // Advance after the reveal pause
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ENDING) return;
    const t = setTimeout(() => {
      if (currentRound >= totalRounds) endGame();
      else startNextRound();
    }, 4000);
    return () => clearTimeout(t);
  }, [isHost, phase, currentRound, totalRounds, endGame, startNextRound]);

  // -----------------------------------------------------------------------
  // Player input
  // -----------------------------------------------------------------------
  const handleChange = useCallback((idx: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (hasSubmitted || phase !== GamePhase.ROUND_ACTIVE) return;
      const cleaned = answers.map((a) => sanitizeMessage(a));
      playerAction({ type: 'submit_answers', answers: cleaned });
      setHasSubmitted(true);
    },
    [answers, hasSubmitted, phase, playerAction],
  );

  const playerName = (id: string) => players.find((p: Player) => p.id === id)?.name ?? 'Unknown';

  // -----------------------------------------------------------------------
  // Render states
  // -----------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">Rolling the letter... 🔠</p>
        </div>
      </div>
    );
  }

  if (phase === GamePhase.RESULTS || phase === GamePhase.GAME_ENDING) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card glow="yellow" className="max-w-lg w-full text-center">
          <h2 className="font-display text-3xl text-neon-yellow mb-6">Game Over!</h2>
          <Scoreboard scores={scores} players={players} currentPlayerId={currentPlayerId ?? ''} />
        </Card>
      </div>
    );
  }

  if (!rd || !hasRound) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isReveal = phase === GamePhase.ROUND_ENDING && rd.tally;

  return (
    <div className="flex-1 flex flex-col items-center gap-4 p-4 overflow-y-auto">
      {/* Top bar */}
      <div className="w-full max-w-3xl flex items-center justify-between flex-wrap gap-2">
        <span className="font-display text-lg text-white/60">
          Round {currentRound}/{totalRounds}
        </span>
        <span className="text-sm text-white/40 font-body">
          {submittedCount}/{connectedPlayers.length} locked in
        </span>
      </div>

      {/* Letter */}
      <Card glow="yellow" className="w-full max-w-3xl flex items-center justify-center gap-4 py-5">
        <span className="font-body text-sm text-white/40 uppercase tracking-wider">
          Every answer starts with
        </span>
        <span className="font-display text-5xl text-neon-yellow">{rd.letter}</span>
      </Card>

      {/* Reveal view */}
      {isReveal ? (
        <Card className="w-full max-w-3xl">
          <h3 className="font-display text-lg text-neon-yellow mb-3">Results</h3>
          <div className="flex flex-col gap-4">
            {rd.tally!.perCategory.map((cat) => (
              <div key={cat.category}>
                <p className="font-body text-sm text-white/70 mb-1.5">{cat.category}</p>
                <div className="flex flex-col gap-1">
                  {cat.entries
                    .filter((e) => e.answer.trim().length > 0)
                    .map((e) => (
                      <div
                        key={e.playerId}
                        className={[
                          'flex items-center justify-between px-3 py-1.5 rounded-lg',
                          e.unique
                            ? 'bg-neon-green/10'
                            : e.valid
                              ? 'bg-white/5'
                              : 'bg-neon-pink/10',
                        ].join(' ')}
                      >
                        <span className="font-body text-sm">
                          <span className="text-white/50 mr-2">{playerName(e.playerId)}:</span>
                          <span
                            className={
                              e.unique ? 'text-neon-green' : e.valid ? 'text-white/70' : 'text-neon-pink line-through'
                            }
                          >
                            {e.answer}
                          </span>
                        </span>
                        <span className="font-mono text-xs font-bold text-neon-yellow">
                          {e.unique ? '+100' : '+0'}
                        </span>
                      </div>
                    ))}
                  {cat.entries.every((e) => e.answer.trim().length === 0) && (
                    <p className="text-white/30 text-xs font-body px-3">No answers</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        /* Active input view */
        <form onSubmit={handleSubmit} className="w-full max-w-3xl flex flex-col gap-3">
          {rd.categories.map((category, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <label className="font-body text-sm text-white/60 w-1/2 shrink-0">{category}</label>
              <input
                type="text"
                value={answers[idx] ?? ''}
                onChange={(e) => handleChange(idx, e.target.value)}
                disabled={hasSubmitted}
                placeholder={`${rd.letter}...`}
                autoComplete="off"
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface/80 border-2 border-white/15 text-white font-body placeholder:text-white/25 focus:outline-none focus:border-neon-cyan/60 disabled:opacity-50 transition-all"
              />
            </div>
          ))}
          {!hasSubmitted ? (
            <Button variant="primary" size="lg" type="submit" className="self-center mt-2">
              Lock in answers 🔒
            </Button>
          ) : (
            <p className="self-center mt-2 font-display text-lg text-neon-cyan">
              Locked in! Waiting for others...
            </p>
          )}
        </form>
      )}
    </div>
  );
};

export default ScattergoriesGame;
