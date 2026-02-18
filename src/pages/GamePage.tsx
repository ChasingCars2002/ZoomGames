import React, { Suspense, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { useRoomContext } from '../context/RoomContext';
import { GamePhase, GameType } from '../types';
import { GAME_MAP } from '../constants/games';
import Header from '../components/layout/Header';
import Scoreboard from '../components/game/Scoreboard';
import Timer from '../components/ui/Timer';
import RoundTransition from '../components/game/RoundTransition';
import Card from '../components/ui/Card';

// ---------------------------------------------------------------------------
// Lazy-loaded game components
// ---------------------------------------------------------------------------

const TriviaGame = React.lazy(
  () => import('../components/games/trivia/TriviaGame')
);
const WordScrambleGame = React.lazy(
  () => import('../components/games/word-scramble/WordScrambleGame')
);
const PictionaryGame = React.lazy(
  () => import('../components/games/pictionary/PictionaryGame')
);
const WordAssociationGame = React.lazy(
  () => import('../components/games/word-association/WordAssociationGame')
);
const TwoTruthsGame = React.lazy(
  () => import('../components/games/two-truths/TwoTruthsGame')
);
const CharadesGame = React.lazy(
  () => import('../components/games/charades/CharadesGame')
);

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

const GameLoadingFallback: React.FC = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <div
        className="w-12 h-12 border-4 border-neon-cyan/30 border-t-neon-cyan rounded-full mx-auto mb-4"
        style={{ animation: 'spin 1s linear infinite' }}
      />
      <p className="font-body text-white/50">Loading game...</p>
    </div>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// ---------------------------------------------------------------------------
// Game component resolver
// ---------------------------------------------------------------------------

const GameRenderer: React.FC<{ gameType: GameType | null }> = ({ gameType }) => {
  switch (gameType) {
    case GameType.TRIVIA:
      return <TriviaGame />;
    case GameType.WORD_SCRAMBLE:
      return <WordScrambleGame />;
    case GameType.PICTIONARY:
      return <PictionaryGame />;
    case GameType.WORD_ASSOCIATION:
      return <WordAssociationGame />;
    case GameType.TWO_TRUTHS:
      return <TwoTruthsGame />;
    case GameType.CHARADES:
      return <CharadesGame />;
    default:
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-body text-white/50">No game selected</p>
        </div>
      );
  }
};

// ---------------------------------------------------------------------------
// GamePage
// ---------------------------------------------------------------------------

const GamePage: React.FC = () => {
  const { engineState, dispatch, endGame } = useGameContext();
  const { room, currentPlayerId, isHost } = useRoomContext();

  const {
    phase,
    gameType,
    currentRound,
    totalRounds,
    scores,
    players,
    timeRemaining,
    config,
  } = engineState;

  const roundEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Game name for header
  const gameName = useMemo(
    () => (gameType ? GAME_MAP[gameType]?.name : undefined),
    [gameType]
  );

  const playerCount = room?.players.length ?? players.length;

  // Show round transition overlay
  const showTransition =
    phase === GamePhase.GAME_STARTING || phase === GamePhase.ROUND_STARTING;

  // Handle round transition complete (host dispatches START_ROUND)
  const handleTransitionComplete = useCallback(() => {
    if (isHost) {
      dispatch({
        type: 'START_ROUND',
        roundData: { startedAt: Date.now() },
      });
    }
  }, [isHost, dispatch]);

  // Auto-advance from ROUND_ENDING: host dispatches START_ROUND for next round
  useEffect(() => {
    if (phase !== GamePhase.ROUND_ENDING || !isHost) return;

    roundEndTimerRef.current = setTimeout(() => {
      if (currentRound < totalRounds) {
        // More rounds to go
        dispatch({
          type: 'START_ROUND',
          roundData: { startedAt: Date.now() },
        });
      } else {
        // Last round ended, transition to game ending
        dispatch({ type: 'END_GAME' });
      }
    }, 3000);

    return () => {
      if (roundEndTimerRef.current) {
        clearTimeout(roundEndTimerRef.current);
      }
    };
  }, [phase, isHost, currentRound, totalRounds, dispatch]);

  // Auto-transition from GAME_ENDING: after 2s, host dispatches END_GAME results
  useEffect(() => {
    if (phase !== GamePhase.GAME_ENDING || !isHost) return;

    gameEndTimerRef.current = setTimeout(() => {
      endGame();
    }, 2000);

    return () => {
      if (gameEndTimerRef.current) {
        clearTimeout(gameEndTimerRef.current);
      }
    };
  }, [phase, isHost, endGame]);

  // Transition message
  const transitionMessage = useMemo(() => {
    if (phase === GamePhase.GAME_STARTING) {
      return gameName ? `Starting ${gameName}...` : 'Get ready!';
    }
    return undefined;
  }, [phase, gameName]);

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Header */}
      <Header
        roomCode={room?.code}
        playerCount={playerCount}
        gameName={gameName}
      />

      {/* Main content area */}
      <div className="flex-1 flex gap-4 px-4 pb-4 overflow-hidden">
        {/* Game area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Suspense fallback={<GameLoadingFallback />}>
            <GameRenderer gameType={gameType} />
          </Suspense>
        </div>

        {/* Sidebar: Scoreboard + Timer */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-4">
          {/* Timer */}
          <Card glow="none" className="p-4 flex items-center justify-center">
            <Timer
              timeRemaining={timeRemaining}
              totalTime={config.timeLimit}
              size="md"
              showSeconds
            />
          </Card>

          {/* Round indicator */}
          <Card glow="none" className="p-3 text-center">
            <p className="font-body text-sm text-white/50">Round</p>
            <p className="font-display text-xl text-white">
              {currentRound} <span className="text-white/30">/ {totalRounds}</span>
            </p>
          </Card>

          {/* Scoreboard */}
          <Card glow="none" className="flex-1 p-4 overflow-y-auto">
            <Scoreboard
              scores={scores}
              players={players}
              currentPlayerId={currentPlayerId ?? ''}
            />
          </Card>
        </div>
      </div>

      {/* Round Transition Overlay */}
      {showTransition && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm">
          <RoundTransition
            round={currentRound}
            totalRounds={totalRounds}
            message={transitionMessage}
            onComplete={handleTransitionComplete}
          />
        </div>
      )}

      {/* Round ending brief results overlay */}
      {phase === GamePhase.ROUND_ENDING && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-navy-900/60 backdrop-blur-sm">
          <Card glow="yellow" className="p-8 text-center max-w-md">
            <h2 className="font-display text-2xl text-neon-yellow mb-2">Round Complete!</h2>
            <p className="font-body text-white/60 mb-4">
              {currentRound < totalRounds
                ? 'Next round starting soon...'
                : 'Final scores incoming...'}
            </p>
            <div className="flex justify-center">
              <div
                className="w-8 h-8 border-3 border-neon-yellow/30 border-t-neon-yellow rounded-full"
                style={{ animation: 'spin 1s linear infinite' }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Game ending overlay */}
      {phase === GamePhase.GAME_ENDING && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-navy-900/70 backdrop-blur-sm">
          <Card glow="cyan" className="p-8 text-center max-w-md">
            <h2 className="font-display text-3xl text-neon-cyan mb-2">Game Over!</h2>
            <p className="font-body text-white/60">Calculating final results...</p>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GamePage;
