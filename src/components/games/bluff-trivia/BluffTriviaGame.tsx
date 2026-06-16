import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase, Player } from '../../../types';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { useTransportContext } from '../../../context/TransportContext';
import { shuffle } from '../../../lib/utils/shuffle';
import { sanitizeStatement } from '../../../lib/security/sanitize';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Avatar from '../../ui/Avatar';
import Scoreboard from '../../game/Scoreboard';
import { BLUFF_QUESTIONS, BluffQuestion } from './BluffData';
import {
  BluffOption,
  MaskedOption,
  BluffActionEntry,
  assembleOptions,
  maskOptions,
  deriveFakes,
  derivePicks,
  scoreBluffRound,
  normalizeAnswer,
} from './bluffLogic';

interface BluffRoundData {
  questionId: string;
  question: string;
  category: string;
  phase: 'writing' | 'choosing' | 'revealing';
  options: (BluffOption | MaskedOption)[];
  picks: Record<string, number>;
  revealed: boolean;
  truthIndex?: number;
  actions?: BluffActionEntry[];
}

const OPTION_COLORS = [
  'bg-indigo-600/25 border-indigo-400/30 hover:border-indigo-400/60',
  'bg-violet-600/25 border-violet-400/30 hover:border-violet-400/60',
  'bg-sky-600/25 border-sky-400/30 hover:border-sky-400/60',
  'bg-teal-600/25 border-teal-400/30 hover:border-teal-400/60',
  'bg-fuchsia-600/25 border-fuchsia-400/30 hover:border-fuchsia-400/60',
  'bg-cyan-600/25 border-cyan-400/30 hover:border-cyan-400/60',
];

const BluffTriviaGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();
  const { transport } = useTransportContext();

  const { phase, players, scores, currentRound, totalRounds, roundData } = engineState;
  const rd = roundData as BluffRoundData | null;
  const hasRound = Boolean(rd && rd.questionId);

  // Host-only secrets — never placed in synced roundData until reveal.
  const truthRef = useRef<string>('');
  const keyedOptionsRef = useRef<BluffOption[] | null>(null);
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const roundEndedRef = useRef(false);

  const [fakeInput, setFakeInput] = useState('');
  const [hasSubmittedFake, setHasSubmittedFake] = useState(false);
  const [myFakeNorm, setMyFakeNorm] = useState('');
  const [hasPicked, setHasPicked] = useState(false);
  const [myPick, setMyPick] = useState<number | null>(null);

  const connectedPlayers = useMemo(() => players.filter((p) => p.connected), [players]);
  const fakes = useMemo(() => (hasRound ? deriveFakes(rd!.actions) : {}), [rd?.actions, hasRound]);
  const writtenCount = connectedPlayers.filter((p) => fakes[p.id]).length;

  const pickedCount = useMemo(() => {
    if (!rd?.actions || !rd.options) return 0;
    const seen = new Set<string>();
    for (const e of rd.actions) {
      if (e.action.type === 'pick_answer' && typeof e.action.index === 'number') {
        if (e.action.index >= 0 && e.action.index < rd.options.length) seen.add(e.playerId);
      }
    }
    return seen.size;
  }, [rd?.actions, rd?.options]);

  const playerName = useCallback(
    (id: string) => players.find((p: Player) => p.id === id)?.name ?? 'Unknown',
    [players],
  );

  // Broadcast an updated roundData immediately (the periodic 1Hz sync also carries it).
  const broadcastRoundData = useCallback(
    (nextRd: BluffRoundData) => {
      const st = engineState;
      transport?.send({
        type: 'GAME_STATE_SYNC',
        payload: {
          phase: st.phase,
          gameType: st.gameType,
          config: st.config,
          scores: st.scores,
          currentRound: st.currentRound,
          totalRounds: st.totalRounds,
          roundData: nextRd,
          hostId: st.hostId,
          timeRemaining: st.timeRemaining,
          players: st.players,
        },
      });
    },
    [engineState, transport],
  );

  // -----------------------------------------------------------------------
  // Host: start round
  // -----------------------------------------------------------------------
  const pickQuestion = useCallback((): BluffQuestion => {
    const map: Record<string, 1 | 2 | 3> = { easy: 1, medium: 2, hard: 3 };
    const target = map[engineState.config.difficulty] ?? 2;
    let pool = BLUFF_QUESTIONS.filter((q) => !usedQuestionsRef.current.has(q.id));
    const diff = pool.filter((q) => q.difficulty === target);
    if (diff.length > 0) pool = diff;
    if (pool.length === 0) {
      usedQuestionsRef.current.clear();
      pool = [...BLUFF_QUESTIONS];
    }
    const picked = shuffle(pool)[0];
    usedQuestionsRef.current.add(picked.id);
    return picked;
  }, [engineState.config.difficulty]);

  const startNextRound = useCallback(() => {
    if (!isHost) return;
    const q = pickQuestion();
    truthRef.current = q.answer;
    keyedOptionsRef.current = null;
    roundEndedRef.current = false;

    const newRoundData: BluffRoundData = {
      questionId: q.id,
      question: q.question,
      category: q.category,
      phase: 'writing',
      options: [],
      picks: {},
      revealed: false,
    };
    dispatch({ type: 'START_ROUND', roundData: newRoundData });
    transport?.send({ type: 'ROUND_START', payload: { round: currentRound + 1, data: newRoundData } });
  }, [isHost, pickQuestion, dispatch, transport, currentRound]);

  useEffect(() => {
    if (!isHost || phase !== GamePhase.GAME_STARTING) return;
    const t = setTimeout(startNextRound, 600);
    return () => clearTimeout(t);
  }, [isHost, phase, startNextRound]);

  // Reset local state on each new round
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) {
      setFakeInput('');
      setHasSubmittedFake(false);
      setMyFakeNorm('');
      setHasPicked(false);
      setMyPick(null);
    }
  }, [phase, currentRound]);

  // -----------------------------------------------------------------------
  // Host: resolve round (compute scores + reveal)
  // -----------------------------------------------------------------------
  const finishRound = useCallback(() => {
    if (!isHost || !rd || roundEndedRef.current) return;
    roundEndedRef.current = true;

    const fakeList = Object.entries(deriveFakes(rd.actions)).map(([playerId, text]) => ({ playerId, text }));
    const keyed = keyedOptionsRef.current ?? shuffle(assembleOptions(truthRef.current, fakeList));
    keyedOptionsRef.current = keyed;

    const picks = derivePicks(rd.actions, keyed);
    const roundScores = scoreBluffRound(keyed, picks, players);
    const truthIndex = keyed.findIndex((o) => o.isTruth);

    const revealedRd: BluffRoundData = {
      ...rd,
      phase: 'revealing',
      options: keyed,
      picks,
      truthIndex,
      revealed: true,
    };
    dispatch({ type: 'END_ROUND', scores: roundScores, roundData: revealedRd });
    transport?.send({ type: 'ROUND_END', payload: { scores: roundScores, roundData: revealedRd } });
  }, [isHost, rd, players, dispatch, transport]);

  // Host: advance phases by folding the action log
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ACTIVE || !rd) return;

    if (rd.phase === 'writing') {
      // Everyone has written a fake -> assemble options and move to choosing.
      if (
        connectedPlayers.length > 0 &&
        writtenCount >= connectedPlayers.length &&
        !keyedOptionsRef.current
      ) {
        const fakeList = Object.entries(fakes).map(([playerId, text]) => ({ playerId, text }));
        const keyed = shuffle(assembleOptions(truthRef.current, fakeList));
        keyedOptionsRef.current = keyed;
        const nextRd: BluffRoundData = { ...rd, phase: 'choosing', options: maskOptions(keyed) };
        dispatch({ type: 'UPDATE_ROUND_DATA', roundData: nextRd });
        broadcastRoundData(nextRd);
      }
    } else if (rd.phase === 'choosing' && keyedOptionsRef.current) {
      const picks = derivePicks(rd.actions, keyedOptionsRef.current);
      if (connectedPlayers.length > 0 && Object.keys(picks).length >= connectedPlayers.length) {
        finishRound();
      }
    }
  }, [isHost, phase, rd, connectedPlayers.length, writtenCount, fakes, dispatch, broadcastRoundData, finishRound]);

  // Host: timer expired
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ENDING || roundEndedRef.current) return;
    finishRound();
  }, [isHost, phase, finishRound]);

  // Host: advance after reveal pause
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ENDING) return;
    const t = setTimeout(() => {
      if (currentRound >= totalRounds) endGame();
      else startNextRound();
    }, 5500);
    return () => clearTimeout(t);
  }, [isHost, phase, currentRound, totalRounds, endGame, startNextRound]);

  // -----------------------------------------------------------------------
  // Player input
  // -----------------------------------------------------------------------
  const submitFake = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (hasSubmittedFake || phase !== GamePhase.ROUND_ACTIVE) return;
      const text = sanitizeStatement(fakeInput);
      if (!text) return;
      playerAction({ type: 'submit_fake', text });
      setMyFakeNorm(normalizeAnswer(text));
      setHasSubmittedFake(true);
    },
    [fakeInput, hasSubmittedFake, phase, playerAction],
  );

  const pick = useCallback(
    (index: number) => {
      if (hasPicked || phase !== GamePhase.ROUND_ACTIVE) return;
      playerAction({ type: 'pick_answer', index });
      setMyPick(index);
      setHasPicked(true);
    },
    [hasPicked, phase, playerAction],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">Cooking up questions... 🤥</p>
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

  const isReveal = phase === GamePhase.ROUND_ENDING || rd.phase === 'revealing';
  const revealScores =
    isReveal && rd.options
      ? scoreBluffRound(rd.options as BluffOption[], rd.picks ?? {}, players)
      : {};

  return (
    <div className="flex-1 flex flex-col items-center gap-4 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl flex items-center justify-between flex-wrap gap-2">
        <span className="font-display text-lg text-white/60">
          Round {currentRound}/{totalRounds}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-body border bg-neon-purple/20 text-purple-300 border-purple-400/30">
          {rd.category}
        </span>
      </div>

      {/* Question */}
      <Card glow="cyan" className="w-full max-w-2xl text-center py-6">
        <p className="font-body text-sm text-white/40 uppercase tracking-wider mb-2">
          {rd.phase === 'writing' ? 'Fill in the blank with a convincing lie' : 'Which one is the truth?'}
        </p>
        <p className="font-display text-xl md:text-2xl text-white leading-snug">{rd.question}</p>
      </Card>

      {/* Writing */}
      {rd.phase === 'writing' && !isReveal && (
        <div className="w-full max-w-md flex flex-col items-center gap-3">
          {!hasSubmittedFake ? (
            <form onSubmit={submitFake} className="w-full flex flex-col items-center gap-3">
              <input
                type="text"
                value={fakeInput}
                onChange={(e) => setFakeInput(e.target.value)}
                placeholder="Your fake answer..."
                autoComplete="off"
                className="w-full px-5 py-3 rounded-xl bg-surface/80 border-2 border-white/20 text-white font-body text-lg text-center placeholder:text-white/30 focus:outline-none focus:border-neon-cyan/60"
              />
              <Button variant="primary" size="lg" type="submit" disabled={!fakeInput.trim()}>
                Submit fib 🤥
              </Button>
            </form>
          ) : (
            <p className="font-display text-lg text-neon-cyan text-center">
              Fib submitted! Waiting for others...
            </p>
          )}
          <p className="text-sm text-white/40 font-body">
            {writtenCount}/{connectedPlayers.length} fibs in
          </p>
        </div>
      )}

      {/* Choosing */}
      {rd.phase === 'choosing' && !isReveal && (
        <div className="w-full max-w-2xl flex flex-col gap-2.5">
          {rd.options.map((opt, idx) => {
            const isMine = normalizeAnswer(opt.text) === myFakeNorm && myFakeNorm.length > 0;
            const isMyPick = myPick === idx;
            const disabled = isMine || hasPicked;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => pick(idx)}
                disabled={disabled}
                className={[
                  'w-full text-left px-5 py-3.5 rounded-xl border-2 font-body text-white transition-all',
                  OPTION_COLORS[idx % OPTION_COLORS.length],
                  isMyPick ? 'ring-2 ring-neon-cyan scale-[1.01]' : '',
                  isMine ? 'opacity-40 cursor-not-allowed' : '',
                  hasPicked && !isMyPick ? 'opacity-60' : '',
                ].join(' ')}
              >
                {opt.text}
                {isMine && <span className="ml-2 text-xs text-white/50">(your fib)</span>}
              </button>
            );
          })}
          <p className="text-sm text-white/40 font-body text-center mt-1">
            {hasPicked ? 'Locked in! ' : ''}
            {pickedCount}/{connectedPlayers.length} picked
          </p>
        </div>
      )}

      {/* Revealing */}
      {isReveal && rd.options && rd.options.length > 0 && (
        <div className="w-full max-w-2xl flex flex-col gap-2.5">
          {(rd.options as BluffOption[]).map((opt) => {
            const pickers = Object.entries(rd.picks ?? {})
              .filter(([, i]) => (rd.options as BluffOption[])[i]?.id === opt.id)
              .map(([pid]) => pid);
            return (
              <div
                key={opt.id}
                className={[
                  'w-full px-5 py-3 rounded-xl border-2',
                  opt.isTruth ? 'bg-neon-green/15 border-neon-green/50' : 'bg-white/5 border-white/15',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body text-white">
                    {opt.text}
                    {opt.isTruth && <span className="ml-2 text-neon-green font-display text-sm">✓ TRUTH</span>}
                  </span>
                  {!opt.isTruth && opt.authorIds.length > 0 && (
                    <span className="text-xs text-white/40 font-body shrink-0">
                      by {opt.authorIds.map(playerName).join(', ')}
                    </span>
                  )}
                </div>
                {pickers.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs text-white/30 font-body">picked by</span>
                    {pickers.map((pid) => (
                      <Avatar key={pid} name={playerName(pid)} size="sm" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <Card className="mt-2">
            <h3 className="font-display text-base text-neon-yellow mb-2">Round points</h3>
            <div className="flex flex-col gap-1">
              {players
                .map((p) => ({ p, pts: revealScores[p.id] ?? 0 }))
                .sort((a, b) => b.pts - a.pts)
                .map(({ p, pts }) => (
                  <div key={p.id} className="flex items-center justify-between px-2 py-1">
                    <span className="font-body text-sm text-white/80">{p.name}</span>
                    <span className="font-mono text-sm font-bold text-neon-yellow">+{pts}</span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BluffTriviaGame;
