import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { useRoomContext } from '../context/RoomContext';
import FinalPodium from '../components/game/FinalPodium';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

// ---------------------------------------------------------------------------
// Confetti particle
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ['#f5e642', '#ff2d78', '#00e5ff', '#39ff14', '#bf40ff', '#ff8c00'];

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));
}

// ---------------------------------------------------------------------------
// ResultsPage
// ---------------------------------------------------------------------------

const ResultsPage: React.FC = () => {
  const { engineState, returnToLobby } = useGameContext();
  const { room, currentPlayerId, isHost, leaveRoom } = useRoomContext();

  const { scores, players } = engineState;

  const [confettiPieces] = useState<ConfettiPiece[]>(() => generateConfetti(60));
  const [showContent, setShowContent] = useState(false);

  // Delay content appearance for dramatic effect
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    if (isHost) {
      returnToLobby();
    }
  }, [isHost, returnToLobby]);

  // Handle leave room
  const handleLeaveRoom = useCallback(() => {
    leaveRoom();
  }, [leaveRoom]);

  // Find winner name
  const winnerName = useMemo(() => {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) return '';
    const winnerId = sorted[0][0];
    const winner = players.find((p) => p.id === winnerId);
    return winner?.name ?? 'Unknown';
  }, [scores, players]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4 py-8">
      {/* Confetti animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            className="absolute"
            style={{
              left: `${piece.x}%`,
              top: '-5%',
              width: `${piece.size}px`,
              height: `${piece.size * 1.5}px`,
              backgroundColor: piece.color,
              borderRadius: '2px',
              transform: `rotate(${piece.rotation}deg)`,
              animation: `confettiFall ${piece.duration}s ease-in ${piece.delay}s infinite`,
              opacity: 0.8,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center gap-6 w-full max-w-2xl transition-all duration-700 ${
          showContent
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
        {/* Winner announcement */}
        <div className="text-center mb-2">
          <h1
            className="font-display text-4xl md:text-5xl text-neon-yellow mb-2"
            style={{
              textShadow: '0 0 20px rgba(245, 230, 66, 0.5), 0 0 40px rgba(245, 230, 66, 0.3)',
            }}
          >
            Game Over!
          </h1>
          {winnerName && (
            <p className="font-body text-lg text-white/60">
              <span className="text-neon-cyan font-semibold">{winnerName}</span> wins!
            </p>
          )}
        </div>

        {/* Podium */}
        <div className="w-full">
          <FinalPodium
            scores={scores}
            players={players}
            onPlayAgain={handlePlayAgain}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-4 mt-4">
          {isHost ? (
            <Button variant="primary" size="lg" onClick={handlePlayAgain}>
              Play Again
            </Button>
          ) : (
            <Card glow="none" className="px-4 py-2">
              <p className="font-body text-sm text-white/40 animate-pulse">
                Waiting for host to start next game...
              </p>
            </Card>
          )}
          <Button variant="ghost" size="md" onClick={handleLeaveRoom}>
            Leave Room
          </Button>
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 0.9;
          }
          25% {
            transform: translateY(25vh) rotate(180deg) scale(0.9) translateX(20px);
            opacity: 0.8;
          }
          50% {
            transform: translateY(50vh) rotate(360deg) scale(1) translateX(-10px);
            opacity: 0.7;
          }
          75% {
            transform: translateY(75vh) rotate(540deg) scale(0.8) translateX(15px);
            opacity: 0.5;
          }
          100% {
            transform: translateY(105vh) rotate(720deg) scale(0.6) translateX(-5px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ResultsPage;
