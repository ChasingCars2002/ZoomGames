import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase } from '../../../types/game';
import { useGameContext } from '../../../context/GameContext';
import { useRoomContext } from '../../../context/RoomContext';
import { useTransportContext } from '../../../context/TransportContext';
import { shuffle } from '../../../lib/utils/shuffle';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Scoreboard from '../../game/Scoreboard';
import HangmanFigure from './HangmanFigure';
import { HANGMAN_WORDS, HangmanWord } from './HangmanData';
import {
  HangmanRoundData,
  deriveHangmanState,
  maskWord,
  normalizeLetter,
  MAX_WRONG,
  TEAM_WIN_BONUS,
} from './hangmanLogic';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const HangmanGame: React.FC = () => {
  const { engineState, dispatch, playerAction, endGame } = useGameContext();
  const { currentPlayerId, isHost } = useRoomContext();
  const { transport } = useTransportContext();

  const { phase, players, scores, currentRound, totalRounds, roundData, config } = engineState;

  const rd = roundData as HangmanRoundData | null;
  const hasWord = Boolean(rd && typeof rd.word === 'string' && rd.word.length > 0);

  const derived = useMemo(
    () => (rd && hasWord ? deriveHangmanState(rd) : null),
    [rd, hasWord],
  );

  const usedWordsRef = useRef<Set<string>>(new Set());
  const roundEndedRef = useRef(false);

  // Optimistic UI: letters this player tapped that haven't echoed back from
  // the host yet show as "pending" instead of feeling unresponsive.
  const [pendingLetters, setPendingLetters] = useState<Set<string>>(new Set());
  const [solveInput, setSolveInput] = useState('');
  const [showSolve, setShowSolve] = useState(false);

  // -----------------------------------------------------------------------
  // Word selection (host only)
  // -----------------------------------------------------------------------
  const pickWord = useCallback((): HangmanWord => {
    const difficultyMap: Record<string, 1 | 2 | 3> = { easy: 1, medium: 2, hard: 3 };
    const target = difficultyMap[config.difficulty] ?? 2;

    let pool = HANGMAN_WORDS.filter((w) => !usedWordsRef.current.has(w.word));
    const diffPool = pool.filter((w) => w.difficulty === target);
    if (diffPool.length > 0) pool = diffPool;
    if (pool.length === 0) {
      usedWordsRef.current.clear();
      pool = HANGMAN_WORDS.filter((w) => w.difficulty === target);
      if (pool.length === 0) pool = [...HANGMAN_WORDS];
    }

    const picked = shuffle(pool)[0];
    usedWordsRef.current.add(picked.word);
    return picked;
  }, [config.difficulty]);

  const startNextRound = useCallback(() => {
    if (!isHost) return;

    const entry = pickWord();
    const newRoundData: HangmanRoundData = {
      word: entry.word,
      category: entry.category,
      maxWrong: MAX_WRONG,
    };

    roundEndedRef.current = false;
    dispatch({ type: 'START_ROUND', roundData: newRoundData });
    transport?.send({
      type: 'ROUND_START',
      payload: { round: currentRound + 1, data: newRoundData },
    });
  }, [isHost, pickWord, dispatch, transport, currentRound]);

  // Host: kick off the first round
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.GAME_STARTING) return;
    const timer = setTimeout(startNextRound, 500);
    return () => clearTimeout(timer);
  }, [isHost, phase, startNextRound]);

  // Reset per-round local state
  useEffect(() => {
    if (phase === GamePhase.ROUND_ACTIVE) {
      roundEndedRef.current = false;
      setPendingLetters(new Set());
      setSolveInput('');
      setShowSolve(false);
    }
  }, [phase, currentRound]);

  // Clear pending letters once they appear in the authoritative log
  useEffect(() => {
    if (!derived) return;
    setPendingLetters((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const g of derived.letterGuesses) next.delete(g.letter);
      return next.size === prev.size ? prev : next;
    });
  }, [derived]);

  // -----------------------------------------------------------------------
  // Host: end the round when the action log resolves it
  // -----------------------------------------------------------------------
  const finishRound = useCallback(
    (won: boolean) => {
      if (!rd || !derived || roundEndedRef.current) return;
      roundEndedRef.current = true;

      const roundScores: Record<string, number> = {};
      for (const p of players) {
        let pts = derived.pointsByPlayer[p.id] ?? 0;
        if (won && p.connected) pts += TEAM_WIN_BONUS;
        roundScores[p.id] = pts;
      }

      const finalRd: HangmanRoundData = { ...rd, final: derived };
      dispatch({ type: 'END_ROUND', scores: roundScores, roundData: finalRd });
      transport?.send({
        type: 'ROUND_END',
        payload: { scores: roundScores, roundData: finalRd },
      });
    },
    [rd, derived, players, dispatch, transport],
  );

  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ACTIVE) return;
    if (!derived || derived.outcome === 'pending') return;
    finishRound(derived.outcome === 'won');
  }, [isHost, phase, derived, finishRound]);

  // Host: timer expired (engine flipped to ROUND_ENDING without END_ROUND)
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING) return;
    if (roundEndedRef.current) return;
    finishRound(false);
  }, [isHost, phase, finishRound]);

  // Host: advance to the next round after the reveal pause
  useEffect(() => {
    if (!isHost) return;
    if (phase !== GamePhase.ROUND_ENDING) return;

    const timer = setTimeout(() => {
      if (currentRound >= totalRounds) {
        endGame();
      } else {
        startNextRound();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [isHost, phase, currentRound, totalRounds, endGame, startNextRound]);

  // -----------------------------------------------------------------------
  // Player input
  // -----------------------------------------------------------------------
  const guessedLetters = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const g of derived?.letterGuesses ?? []) map.set(g.letter, g.correct);
    return map;
  }, [derived]);

  const handleLetter = useCallback(
    (letter: string) => {
      if (phase !== GamePhase.ROUND_ACTIVE) return;
      if (!derived || derived.outcome !== 'pending') return;
      if (guessedLetters.has(letter) || pendingLetters.has(letter)) return;

      playerAction({ type: 'guess_letter', letter });
      setPendingLetters((prev) => new Set(prev).add(letter));
    },
    [phase, derived, guessedLetters, pendingLetters, playerAction],
  );

  const handleSolve = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (phase !== GamePhase.ROUND_ACTIVE) return;
      const trimmed = solveInput.trim();
      if (!trimmed) return;
      playerAction({ type: 'guess', guess: trimmed });
      setSolveInput('');
      setShowSolve(false);
    },
    [phase, solveInput, playerAction],
  );

  // Physical keyboard support
  useEffect(() => {
    if (phase !== GamePhase.ROUND_ACTIVE || showSolve) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const letter = normalizeLetter(e.key);
      if (letter) handleLetter(letter);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, showSolve, handleLetter]);

  // -----------------------------------------------------------------------
  // Render: loading states
  // -----------------------------------------------------------------------
  if (phase === GamePhase.GAME_STARTING) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <p className="font-display text-xl text-white/80">Building the gallows... 💀</p>
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

  if (!rd || !hasWord || !derived) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main layout
  // -----------------------------------------------------------------------
  const isReveal = phase === GamePhase.ROUND_ENDING;
  const view = isReveal && rd.final ? rd.final : derived;
  const revealed = new Set(view.revealedLetters);
  const tiles = isReveal
    ? maskWord(rd.word, new Set(rd.word.toUpperCase().split('')))
    : maskWord(rd.word, revealed);
  const livesLeft = Math.max(0, rd.maxWrong - view.wrongCount);
  const wrongLetters = view.letterGuesses.filter((g) => !g.correct).map((g) => g.letter);
  const recentGuesses = view.letterGuesses.slice(-6).reverse();
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown';

  return (
    <div className="flex-1 flex flex-col items-center gap-4 p-4 overflow-y-auto">
      {/* Top bar: round, category, lives */}
      <div className="w-full max-w-3xl flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg text-white/60">
            Round {currentRound}/{totalRounds}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-body border bg-neon-purple/20 text-purple-300 border-purple-400/30">
            {rd.category}
          </span>
        </div>
        <div className="flex items-center gap-1" aria-label={`${livesLeft} lives left`}>
          {Array.from({ length: rd.maxWrong }).map((_, i) => (
            <span
              key={i}
              className={`text-lg transition-opacity duration-300 ${i < livesLeft ? '' : 'opacity-20 grayscale'}`}
            >
              ❤️
            </span>
          ))}
        </div>
      </div>

      {/* Board: figure + word */}
      <div className="w-full max-w-3xl flex flex-col md:flex-row items-center gap-4">
        <Card glow="none" className="p-4 flex items-center justify-center w-full md:w-56 shrink-0">
          <HangmanFigure
            wrongCount={view.wrongCount}
            maxWrong={rd.maxWrong}
            outcome={view.outcome === 'pending' && isReveal ? 'lost' : view.outcome}
          />
        </Card>

        <Card
          glow={isReveal ? (view.outcome === 'won' ? 'cyan' : 'pink') : 'cyan'}
          className="flex-1 w-full text-center py-6 px-4"
        >
          {isReveal && (
            <p
              className={`font-display text-xl mb-3 ${view.outcome === 'won' ? 'text-neon-green' : 'text-neon-pink'}`}
            >
              {view.outcome === 'won'
                ? `🎉 Solved${view.solverId ? ` by ${playerName(view.solverId)}` : ''}!`
                : '💀 The team ran out of guesses!'}
            </p>
          )}

          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {tiles.map((tile, idx) =>
              rd.word[idx] === ' ' ? (
                <div key={idx} className="w-4 md:w-6" />
              ) : (
                <div
                  key={idx}
                  className={[
                    'w-9 h-11 md:w-11 md:h-12 rounded-lg border-b-4 flex items-center justify-center',
                    'transition-all duration-300',
                    tile
                      ? isReveal && !revealed.has(rd.word[idx].toUpperCase()) && /[A-Z]/i.test(rd.word[idx])
                        ? 'bg-neon-pink/10 border-neon-pink/50'
                        : 'bg-neon-cyan/10 border-neon-cyan/50'
                      : 'bg-white/5 border-white/30',
                  ].join(' ')}
                >
                  <span className="font-display text-xl md:text-2xl text-white">{tile ?? ''}</span>
                </div>
              ),
            )}
          </div>

          {wrongLetters.length > 0 && (
            <p className="mt-4 text-sm font-mono text-white/40">
              Wrong:{' '}
              <span className="text-neon-pink tracking-[0.3em]">{wrongLetters.join(' ')}</span>
            </p>
          )}
        </Card>
      </div>

      {/* Input: letter keyboard + solve */}
      {phase === GamePhase.ROUND_ACTIVE && (
        <div className="w-full max-w-3xl flex flex-col items-center gap-3">
          {!showSolve ? (
            <>
              <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 w-full">
                {ALPHABET.map((letter) => {
                  const result = guessedLetters.get(letter);
                  const guessed = guessedLetters.has(letter);
                  const pending = pendingLetters.has(letter);
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => handleLetter(letter)}
                      disabled={guessed || pending}
                      aria-label={`Guess letter ${letter}`}
                      className={[
                        'h-11 rounded-lg font-display text-lg transition-all duration-150',
                        guessed
                          ? result
                            ? 'bg-neon-green/20 text-neon-green border border-neon-green/40 cursor-default'
                            : 'bg-neon-pink/15 text-neon-pink/60 border border-neon-pink/30 line-through cursor-default'
                          : pending
                            ? 'bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/40 animate-pulse cursor-wait'
                            : 'bg-surface-light text-white border border-white/15 hover:border-neon-cyan/60 hover:bg-neon-cyan/10 active:scale-95',
                      ].join(' ')}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowSolve(true)}>
                🎯 I know the answer!
              </Button>
            </>
          ) : (
            <form onSubmit={handleSolve} className="w-full max-w-md flex flex-col items-center gap-2">
              <input
                autoFocus
                type="text"
                value={solveInput}
                onChange={(e) => setSolveInput(e.target.value)}
                placeholder="Type the full word or phrase..."
                autoComplete="off"
                className="w-full px-5 py-3 rounded-xl bg-surface/80 border-2 border-white/20 text-white font-body text-lg text-center uppercase tracking-wider placeholder:text-white/30 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-neon-cyan/60 transition-all"
              />
              <div className="flex items-center gap-2">
                <Button variant="primary" size="md" type="submit" disabled={!solveInput.trim()}>
                  Solve (wrong = 1 strike!)
                </Button>
                <Button variant="ghost" size="md" type="button" onClick={() => setShowSolve(false)}>
                  Back to letters
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Live guess log */}
      {recentGuesses.length > 0 && (
        <Card glow="none" className="w-full max-w-3xl p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-body text-xs text-white/40 uppercase tracking-wider">
              Recent
            </span>
            {recentGuesses.map((g, idx) => (
              <span
                key={`${g.letter}-${idx}`}
                className={`font-body text-xs px-2 py-1 rounded-full border ${
                  g.correct
                    ? 'bg-neon-green/10 text-neon-green border-neon-green/30'
                    : 'bg-neon-pink/10 text-neon-pink border-neon-pink/30'
                }`}
              >
                {playerName(g.playerId)}: {g.letter} {g.correct ? '✓' : '✗'}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Reveal: round points */}
      {isReveal && Object.keys(view.pointsByPlayer).length > 0 && (
        <Card className="w-full max-w-md">
          <h3 className="font-display text-lg text-neon-yellow mb-2">Round Points</h3>
          <div className="flex flex-col gap-1.5">
            {Object.entries(view.pointsByPlayer)
              .sort(([, a], [, b]) => b - a)
              .map(([pid, pts]) => (
                <div key={pid} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5">
                  <span className="font-body text-sm text-white">
                    {playerName(pid)}
                    {pid === currentPlayerId && <span className="text-white/40 ml-1">(You)</span>}
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

export default HangmanGame;
