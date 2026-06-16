import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase, Player } from '../../../types';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { useTransportContext } from '../../../context/TransportContext';
import { shuffle } from '../../../lib/utils/shuffle';
import { sanitizeMessage } from '../../../lib/security/sanitize';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Slider from '../../ui/Slider';
import Scoreboard from '../../game/Scoreboard';
import SpectrumBar, { SpectrumMarker } from './SpectrumBar';
import { SPECTRUMS, Spectrum } from './MindMeldData';
import {
  MeldActionEntry,
  deriveClue,
  derivePositions,
  scoreMeldRound,
} from './meldLogic';

interface MeldRoundData {
  clueGiverId: string;
  playerOrder: string[];
  currentGiverIndex: number;
  phase: 'cluing' | 'guessing' | 'revealing';
  leftLabel: string;
  rightLabel: string;
  clue: string;
  target: number; // real during cluing/reveal, -1 (masked) during guessing
  positions: Record<string, number>;
  revealed: boolean;
  actions?: MeldActionEntry[];
}

const MindMeldGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();
  const { transport } = useTransportContext();

  const { phase, players, scores, currentRound, totalRounds, roundData } = engineState;
  const rd = roundData as MeldRoundData | null;
  const hasRound = Boolean(rd && rd.clueGiverId);

  const targetRef = useRef<number>(50);
  const orderRef = useRef<string[]>([]);
  const usedSpectrumsRef = useRef<Set<string>>(new Set());
  const roundEndedRef = useRef(false);

  const [clueInput, setClueInput] = useState('');
  const [hasSubmittedClue, setHasSubmittedClue] = useState(false);
  const [sliderValue, setSliderValue] = useState(50);
  const [hasSubmittedPosition, setHasSubmittedPosition] = useState(false);

  const connectedPlayers = useMemo(() => players.filter((p) => p.connected), [players]);
  const playerName = useCallback(
    (id: string) => players.find((p: Player) => p.id === id)?.name ?? 'Unknown',
    [players],
  );
  const playerColor = useCallback(
    (id: string) => players.find((p: Player) => p.id === id)?.color ?? '#f5e642',
    [players],
  );

  const positions = useMemo(
    () => (hasRound ? derivePositions(rd!.actions, rd!.clueGiverId) : {}),
    [rd?.actions, rd?.clueGiverId, hasRound],
  );
  const guessedCount = Object.keys(positions).length;
  const expectedGuessers = connectedPlayers.filter((p) => p.id !== rd?.clueGiverId).length;

  const broadcastRoundData = useCallback(
    (nextRd: MeldRoundData) => {
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
  const pickSpectrum = useCallback((): Spectrum => {
    let pool = SPECTRUMS.filter((s) => !usedSpectrumsRef.current.has(s.id));
    if (pool.length === 0) {
      usedSpectrumsRef.current.clear();
      pool = [...SPECTRUMS];
    }
    const picked = shuffle(pool)[0];
    usedSpectrumsRef.current.add(picked.id);
    return picked;
  }, []);

  const startNextRound = useCallback(() => {
    if (!isHost) return;

    if (orderRef.current.length === 0) {
      orderRef.current = shuffle(connectedPlayers.map((p) => p.id));
    }
    const order = orderRef.current;
    if (order.length === 0) return;

    // Rotate giver by completed-round count; skip disconnected players.
    let idx = currentRound % order.length;
    for (let i = 0; i < order.length; i++) {
      const candidate = order[(idx + i) % order.length];
      if (connectedPlayers.some((p) => p.id === candidate)) {
        idx = (idx + i) % order.length;
        break;
      }
    }
    const clueGiverId = order[idx];

    const spectrum = pickSpectrum();
    targetRef.current = Math.floor(Math.random() * 101);
    roundEndedRef.current = false;

    const newRoundData: MeldRoundData = {
      clueGiverId,
      playerOrder: order,
      currentGiverIndex: idx,
      phase: 'cluing',
      leftLabel: spectrum.left,
      rightLabel: spectrum.right,
      clue: '',
      target: targetRef.current, // visible to the clue-giver during cluing only
      positions: {},
      revealed: false,
    };
    dispatch({ type: 'START_ROUND', roundData: newRoundData });
    transport?.send({ type: 'ROUND_START', payload: { round: currentRound + 1, data: newRoundData } });
  }, [isHost, connectedPlayers, currentRound, pickSpectrum, dispatch, transport]);

  useEffect(() => {
    if (!isHost || phase !== GamePhase.GAME_STARTING) return;
    orderRef.current = [];
    const t = setTimeout(startNextRound, 600);
    return () => clearTimeout(t);
  }, [isHost, phase, startNextRound]);

  // Reset local state per round
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) {
      setClueInput('');
      setHasSubmittedClue(false);
      setSliderValue(50);
      setHasSubmittedPosition(false);
    }
  }, [phase, currentRound]);

  // -----------------------------------------------------------------------
  // Host: resolve
  // -----------------------------------------------------------------------
  const finishRound = useCallback(() => {
    if (!isHost || !rd || roundEndedRef.current) return;
    roundEndedRef.current = true;

    const finalPositions = derivePositions(rd.actions, rd.clueGiverId);
    const roundScores = scoreMeldRound(targetRef.current, finalPositions, rd.clueGiverId, players);
    const revealedRd: MeldRoundData = {
      ...rd,
      phase: 'revealing',
      target: targetRef.current,
      positions: finalPositions,
      revealed: true,
    };
    dispatch({ type: 'END_ROUND', scores: roundScores, roundData: revealedRd });
    transport?.send({ type: 'ROUND_END', payload: { scores: roundScores, roundData: revealedRd } });
  }, [isHost, rd, players, dispatch, transport]);

  // Host: advance phases
  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ACTIVE || !rd) return;

    if (rd.phase === 'cluing') {
      // Guard: clue-giver vanished -> resolve with no guesses.
      if (!connectedPlayers.some((p) => p.id === rd.clueGiverId)) {
        finishRound();
        return;
      }
      const clue = deriveClue(rd.actions, rd.clueGiverId).trim();
      if (clue) {
        // Move to guessing and MASK the target so guessers never receive it.
        const nextRd: MeldRoundData = { ...rd, phase: 'guessing', clue, target: -1 };
        dispatch({ type: 'UPDATE_ROUND_DATA', roundData: nextRd });
        broadcastRoundData(nextRd);
      }
    } else if (rd.phase === 'guessing') {
      if (expectedGuessers > 0 && guessedCount >= expectedGuessers) {
        finishRound();
      } else if (expectedGuessers === 0) {
        finishRound(); // no one to guess
      }
    }
  }, [isHost, phase, rd, connectedPlayers, expectedGuessers, guessedCount, dispatch, broadcastRoundData, finishRound]);

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
    }, 5000);
    return () => clearTimeout(t);
  }, [isHost, phase, currentRound, totalRounds, endGame, startNextRound]);

  // -----------------------------------------------------------------------
  // Player input
  // -----------------------------------------------------------------------
  const submitClue = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (hasSubmittedClue || phase !== GamePhase.ROUND_ACTIVE) return;
      const text = sanitizeMessage(clueInput);
      if (!text) return;
      playerAction({ type: 'submit_clue', text });
      setHasSubmittedClue(true);
    },
    [clueInput, hasSubmittedClue, phase, playerAction],
  );

  const submitPosition = useCallback(() => {
    if (hasSubmittedPosition || phase !== GamePhase.ROUND_ACTIVE) return;
    playerAction({ type: 'submit_position', value: sliderValue });
    setHasSubmittedPosition(true);
  }, [hasSubmittedPosition, phase, sliderValue, playerAction]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">Calibrating wavelengths... 📡</p>
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

  const amGiver = currentPlayerId === rd.clueGiverId;
  const isReveal = phase === GamePhase.ROUND_ENDING || rd.phase === 'revealing';

  // Build markers for the spectrum
  const markers: SpectrumMarker[] = [];
  if (isReveal) {
    for (const [pid, pos] of Object.entries(rd.positions ?? {})) {
      markers.push({ id: pid, value: pos, name: playerName(pid), color: playerColor(pid), isMe: pid === currentPlayerId });
    }
  } else if (rd.phase === 'guessing' && !amGiver && !isReveal) {
    markers.push({ id: 'me', value: sliderValue, name: 'You', color: '#00e5ff', isMe: true });
  }

  // Target shown only to the giver during cluing, and to everyone on reveal.
  const shownTarget = isReveal ? rd.target : amGiver && rd.phase === 'cluing' ? rd.target : null;
  const revealScores = isReveal ? scoreMeldRound(rd.target, rd.positions ?? {}, rd.clueGiverId, players) : {};

  return (
    <div className="flex-1 flex flex-col items-center gap-5 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl flex items-center justify-between flex-wrap gap-2">
        <span className="font-display text-lg text-white/60">
          Round {currentRound}/{totalRounds}
        </span>
        <span className="font-body text-sm text-white/50">
          🎙️ Clue-giver: <span className="text-neon-yellow">{playerName(rd.clueGiverId)}</span>
          {amGiver && <span className="text-white/40"> (You)</span>}
        </span>
      </div>

      {/* Spectrum */}
      <Card glow="cyan" className="w-full max-w-2xl py-8 px-6">
        <SpectrumBar
          leftLabel={rd.leftLabel}
          rightLabel={rd.rightLabel}
          markers={markers}
          target={shownTarget}
        />
      </Card>

      {/* Clue display (guessing / reveal) */}
      {(rd.phase === 'guessing' || isReveal) && rd.clue && (
        <Card glow="none" className="w-full max-w-2xl text-center py-4">
          <p className="font-body text-xs text-white/40 uppercase tracking-wider mb-1">The clue</p>
          <p className="font-display text-2xl text-neon-yellow">“{rd.clue}”</p>
        </Card>
      )}

      {/* CLUING */}
      {rd.phase === 'cluing' && !isReveal && (
        amGiver ? (
          <div className="w-full max-w-md flex flex-col items-center gap-3">
            <p className="font-body text-sm text-white/60 text-center">
              Only you can see the 🎯 target. Give a one-line clue to point your team to it!
            </p>
            {!hasSubmittedClue ? (
              <form onSubmit={submitClue} className="w-full flex flex-col items-center gap-3">
                <input
                  type="text"
                  value={clueInput}
                  onChange={(e) => setClueInput(e.target.value)}
                  placeholder="Your clue..."
                  autoComplete="off"
                  className="w-full px-5 py-3 rounded-xl bg-surface/80 border-2 border-white/20 text-white font-body text-lg text-center placeholder:text-white/30 focus:outline-none focus:border-neon-cyan/60"
                />
                <Button variant="primary" size="lg" type="submit" disabled={!clueInput.trim()}>
                  Send clue 📡
                </Button>
              </form>
            ) : (
              <p className="font-display text-lg text-neon-cyan">Clue sent! Waiting for guesses...</p>
            )}
          </div>
        ) : (
          <p className="font-display text-lg text-white/60 text-center">
            ✋ {playerName(rd.clueGiverId)} is thinking of a clue...
          </p>
        )
      )}

      {/* GUESSING */}
      {rd.phase === 'guessing' && !isReveal && (
        amGiver ? (
          <p className="font-display text-lg text-white/60 text-center">
            Waiting for the team to lock in... ({guessedCount}/{expectedGuessers})
          </p>
        ) : (
          <div className="w-full max-w-2xl flex flex-col items-center gap-3">
            <Slider
              value={sliderValue}
              onChange={setSliderValue}
              disabled={hasSubmittedPosition}
              ariaLabel="Your guess on the spectrum"
            />
            {!hasSubmittedPosition ? (
              <Button variant="primary" size="lg" onClick={submitPosition}>
                Lock in my guess 🎯
              </Button>
            ) : (
              <p className="font-display text-lg text-neon-cyan">
                Locked at {sliderValue}! ({guessedCount}/{expectedGuessers})
              </p>
            )}
          </div>
        )
      )}

      {/* REVEAL */}
      {isReveal && (
        <Card className="w-full max-w-md">
          <h3 className="font-display text-base text-neon-yellow mb-2">
            Target was {rd.target} — round points
          </h3>
          <div className="flex flex-col gap-1">
            {players
              .map((p) => ({ p, pts: revealScores[p.id] ?? 0 }))
              .sort((a, b) => b.pts - a.pts)
              .map(({ p, pts }) => (
                <div key={p.id} className="flex items-center justify-between px-2 py-1">
                  <span className="font-body text-sm text-white/80">
                    {p.name}
                    {p.id === rd.clueGiverId && <span className="text-white/40 ml-1">🎙️</span>}
                  </span>
                  <span className="font-mono text-sm font-bold text-neon-yellow">+{pts}</span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MindMeldGame;
