import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { GamePhase, Player } from '../../../types';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { useTransportContext } from '../../../context/TransportContext';
import { shuffle } from '../../../lib/utils/shuffle';
import { calculateGuessPoints } from '../../../lib/engine/ScoreManager';
import Card from '../../ui/Card';
import Scoreboard from '../../game/Scoreboard';
import ChatPanel from '../../game/ChatPanel';
import { EMOJI_PUZZLES, EmojiPuzzle } from './EmojiData';
import { deriveEmojiState, EmojiActionEntry, EmojiFinal } from './emojiLogic';

interface EmojiRoundData {
  puzzleId: string;
  emojis: string;
  answer: string;
  aliases: string[];
  category: string;
  difficulty: 1 | 2 | 3;
  actions?: EmojiActionEntry[];
  final?: EmojiFinal;
}

const EmojiDecodeGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();
  const { transport } = useTransportContext();

  const { phase, players, scores, currentRound, totalRounds, roundData, config, timeRemaining } =
    engineState;
  const totalTime = config.timeLimit;

  const rd = roundData as EmojiRoundData | null;
  const hasRound = Boolean(rd && rd.emojis && rd.answer);

  const derived = useMemo(() => (hasRound ? deriveEmojiState(rd!) : null), [rd, hasRound]);

  const usedPuzzlesRef = useRef<Set<string>>(new Set());
  const roundEndedRef = useRef(false);

  // -----------------------------------------------------------------------
  // Host: start a round
  // -----------------------------------------------------------------------
  const pickPuzzle = useCallback((): EmojiPuzzle => {
    const map: Record<string, 1 | 2 | 3> = { easy: 1, medium: 2, hard: 3 };
    const target = map[config.difficulty] ?? 2;
    let pool = EMOJI_PUZZLES.filter((p) => !usedPuzzlesRef.current.has(p.id));
    const diff = pool.filter((p) => p.difficulty === target);
    if (diff.length > 0) pool = diff;
    if (pool.length === 0) {
      usedPuzzlesRef.current.clear();
      pool = [...EMOJI_PUZZLES];
    }
    const picked = shuffle(pool)[0];
    usedPuzzlesRef.current.add(picked.id);
    return picked;
  }, [config.difficulty]);

  const startNextRound = useCallback(() => {
    if (!isHost) return;
    const p = pickPuzzle();
    const newRoundData: EmojiRoundData = {
      puzzleId: p.id,
      emojis: p.emojis,
      answer: p.answer,
      aliases: p.aliases,
      category: p.category,
      difficulty: p.difficulty,
    };
    roundEndedRef.current = false;
    dispatch({ type: 'START_ROUND', roundData: newRoundData });
    transport?.send({ type: 'ROUND_START', payload: { round: currentRound + 1, data: newRoundData } });
  }, [isHost, pickPuzzle, dispatch, transport, currentRound]);

  useEffect(() => {
    if (!isHost || phase !== GamePhase.GAME_STARTING) return;
    const t = setTimeout(startNextRound, 500);
    return () => clearTimeout(t);
  }, [isHost, phase, startNextRound]);

  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) roundEndedRef.current = false;
  }, [phase, currentRound]);

  // -----------------------------------------------------------------------
  // Host: resolve
  // -----------------------------------------------------------------------
  const finishRound = useCallback(
    (won: boolean) => {
      if (!isHost || !rd || !derived || roundEndedRef.current) return;
      roundEndedRef.current = true;

      const pointsByPlayer: Record<string, number> = {};
      for (const p of players) pointsByPlayer[p.id] = 0;
      if (won && derived.winnerId) {
        pointsByPlayer[derived.winnerId] = calculateGuessPoints(timeRemaining, totalTime, 1);
      }

      const final: EmojiFinal = { winnerId: derived.winnerId, pointsByPlayer };
      const finalRd: EmojiRoundData = { ...rd, final };
      dispatch({ type: 'END_ROUND', scores: pointsByPlayer, roundData: finalRd });
      transport?.send({ type: 'ROUND_END', payload: { scores: pointsByPlayer, roundData: finalRd } });
    },
    [isHost, rd, derived, players, timeRemaining, totalTime, dispatch, transport],
  );

  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ACTIVE || !derived) return;
    if (derived.outcome === 'won') finishRound(true);
  }, [isHost, phase, derived, finishRound]);

  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ENDING || roundEndedRef.current) return;
    finishRound(false);
  }, [isHost, phase, finishRound]);

  useEffect(() => {
    if (!isHost || phase !== GamePhase.ROUND_ENDING) return;
    const t = setTimeout(() => {
      if (currentRound >= totalRounds) endGame();
      else startNextRound();
    }, 3000);
    return () => clearTimeout(t);
  }, [isHost, phase, currentRound, totalRounds, endGame, startNextRound]);

  // -----------------------------------------------------------------------
  // Chat wiring
  // -----------------------------------------------------------------------
  const playerName = useCallback(
    (id: string) => players.find((p: Player) => p.id === id)?.name ?? 'Unknown',
    [players],
  );

  const chatMessages = useMemo(() => {
    if (!derived) return [];
    return derived.guesses.map((g) => ({
      playerId: g.playerId,
      playerName: playerName(g.playerId),
      text: g.text,
      timestamp: g.timestamp,
      isCorrect: g.correct,
    }));
  }, [derived, playerName]);

  const handleSend = useCallback(
    (text: string) => {
      if (phase !== GamePhase.ROUND_ACTIVE) return;
      if (derived && derived.outcome !== 'pending') return;
      playerAction({ type: 'guess', guess: text });
    },
    [phase, derived, playerAction],
  );

  // Progressive, time-based hints
  const fraction = totalTime > 0 ? timeRemaining / totalTime : 1;
  const showCategory = fraction <= 0.66;
  const showLength = fraction <= 0.33;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">Loading puzzles... 🔣</p>
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

  if (!rd || !hasRound || !derived) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isReveal = phase === GamePhase.ROUND_ENDING;
  const solved = derived.outcome === 'won';
  const wordPattern = rd.answer
    .split(' ')
    .map((w) => '•'.repeat(w.length))
    .join('   ');

  return (
    <div className="flex-1 flex gap-4 p-4 min-h-0">
      {/* Board */}
      <div className="flex-1 flex flex-col items-center gap-4 min-w-0">
        <div className="w-full flex items-center justify-between flex-wrap gap-2">
          <span className="font-display text-lg text-white/60">
            Round {currentRound}/{totalRounds}
          </span>
          {(showCategory || isReveal) && (
            <span className="px-3 py-1 rounded-full text-xs font-body border bg-neon-purple/20 text-purple-300 border-purple-400/30">
              {rd.category}
            </span>
          )}
        </div>

        <Card glow={isReveal ? (solved ? 'cyan' : 'pink') : 'cyan'} className="w-full text-center py-10 px-6">
          <div className="text-6xl md:text-7xl leading-relaxed tracking-wide" aria-label="emoji puzzle">
            {rd.emojis}
          </div>

          {isReveal ? (
            <div className="mt-6">
              <p className="font-body text-sm text-white/40 uppercase tracking-wider mb-1">
                {solved ? `🎉 Solved by ${playerName(derived.winnerId ?? '')}` : '⏱️ Time! The answer was'}
              </p>
              <p className="font-display text-3xl text-neon-cyan">{rd.answer}</p>
            </div>
          ) : (
            showLength && (
              <p className="mt-6 font-mono text-2xl text-white/40 tracking-[0.3em]">{wordPattern}</p>
            )
          )}
        </Card>

        {!isReveal && (
          <p className="font-body text-sm text-white/40 text-center">
            Type your guess in the chat → first correct answer wins!
          </p>
        )}
      </div>

      {/* Chat */}
      <div className="w-72 shrink-0 flex flex-col">
        <Card glow="none" className="flex-1 flex flex-col p-0 overflow-hidden">
          <ChatPanel
            messages={chatMessages}
            onSend={handleSend}
            disabled={isReveal || solved}
            placeholder={solved ? 'Round over!' : 'Guess the emoji...'}
          />
        </Card>
      </div>
    </div>
  );
};

export default EmojiDecodeGame;
