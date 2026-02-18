import React, { useEffect, useState } from 'react';
import { Player } from '../../types';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

interface FinalPodiumProps {
  scores: Record<string, number>;
  players: Player[];
  onPlayAgain: () => void;
}

interface RankedPlayer {
  player: Player;
  score: number;
  rank: number;
}

const CONFETTI_COLORS = ['#f5e642', '#ff2d78', '#00e5ff', '#39ff14', '#bf40ff', '#ff8c00'];

const ConfettiParticle: React.FC<{ index: number }> = ({ index }) => {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = `${Math.random() * 100}%`;
  const delay = `${Math.random() * 2}s`;
  const duration = `${Math.random() * 2 + 2}s`;
  const size = Math.random() * 8 + 4;
  const rotation = Math.random() * 360;
  const isCircle = Math.random() > 0.5;

  return (
    <div
      className="absolute top-0 pointer-events-none"
      style={{
        left,
        animationDelay: delay,
        animation: `confettiDrop ${duration} ease-out forwards`,
        animationIterationCount: 'infinite',
      }}
    >
      <div
        style={{
          width: `${size}px`,
          height: isCircle ? `${size}px` : `${size * 0.4}px`,
          backgroundColor: color,
          borderRadius: isCircle ? '50%' : '2px',
          transform: `rotate(${rotation}deg)`,
          animation: `confettiSpin ${duration} linear infinite`,
        }}
      />
    </div>
  );
};

const podiumConfig = {
  1: {
    height: 'h-40',
    bg: 'bg-gradient-to-t from-yellow-600/40 to-yellow-400/20',
    border: 'border-yellow-400/50',
    glow: 'shadow-[0_0_30px_rgba(234,179,8,0.4)]',
    label: '1st',
    emoji: '\uD83E\uDD47',
    labelColor: 'text-yellow-400',
    order: 'order-2',
  },
  2: {
    height: 'h-28',
    bg: 'bg-gradient-to-t from-gray-400/30 to-gray-300/10',
    border: 'border-gray-300/40',
    glow: 'shadow-[0_0_20px_rgba(209,213,219,0.3)]',
    label: '2nd',
    emoji: '\uD83E\uDD48',
    labelColor: 'text-gray-300',
    order: 'order-1',
  },
  3: {
    height: 'h-20',
    bg: 'bg-gradient-to-t from-amber-700/30 to-amber-500/10',
    border: 'border-amber-500/40',
    glow: 'shadow-[0_0_15px_rgba(217,119,6,0.3)]',
    label: '3rd',
    emoji: '\uD83E\uDD49',
    labelColor: 'text-amber-500',
    order: 'order-3',
  },
} as const;

const FinalPodium: React.FC<FinalPodiumProps> = ({
  scores,
  players,
  onPlayAgain,
}) => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Build ranked list
  const ranked: RankedPlayer[] = players
    .map((player) => ({
      player,
      score: scores[player.id] ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const topThree = ranked.slice(0, 3);
  const remaining = ranked.slice(3);

  return (
    <div className="relative flex flex-col items-center gap-6 py-8 px-4 overflow-hidden">
      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => (
          <ConfettiParticle key={i} index={i} />
        ))}
      </div>

      {/* Title */}
      <div className="text-center animate-bounce-in">
        <h2 className="font-display text-4xl text-neon-yellow text-glow-yellow mb-1">
          Game Over!
        </h2>
        <p className="font-body text-sm text-white/50">Final Results</p>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-3 w-full max-w-md mt-4">
        {topThree.map((entry) => {
          const rank = entry.rank as 1 | 2 | 3;
          const config = podiumConfig[rank];
          if (!config) return null;

          return (
            <div
              key={entry.player.id}
              className={[
                'flex-1 flex flex-col items-center',
                config.order,
              ].join(' ')}
            >
              {/* Player info above podium */}
              <div
                className="flex flex-col items-center gap-2 mb-3"
                style={{
                  animation: animate
                    ? `podiumPlayerReveal 0.6s ease-out ${rank * 0.2}s both`
                    : 'none',
                }}
              >
                <span className="text-2xl">{config.emoji}</span>
                <Avatar
                  name={entry.player.name}
                  color={entry.player.color}
                  size="lg"
                  isBot={entry.player.isBot}
                />
                <span className="font-display text-sm text-white truncate max-w-[100px]">
                  {entry.player.name}
                </span>
                <span className="font-mono text-xs text-white/60 font-bold">
                  {entry.score.toLocaleString()} pts
                </span>
              </div>

              {/* Podium bar */}
              <div
                className={[
                  'w-full rounded-t-xl border-t border-l border-r transition-all duration-700 ease-out',
                  config.bg,
                  config.border,
                  config.glow,
                ].join(' ')}
                style={{
                  height: animate ? undefined : '0px',
                  overflow: 'hidden',
                  transition: 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transitionDelay: `${rank * 0.15 + 0.3}s`,
                }}
              >
                <div
                  className={[
                    'flex items-center justify-center w-full',
                    config.height,
                  ].join(' ')}
                >
                  <span className={['font-display text-2xl', config.labelColor].join(' ')}>
                    {config.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Remaining players scoreboard */}
      {remaining.length > 0 && (
        <div className="w-full max-w-md mt-4 animate-fade-in" style={{ animationDelay: '1s', animationFillMode: 'both' }}>
          <div className="border-t border-white/10 pt-4">
            <h3 className="font-display text-xs text-white/40 uppercase tracking-wider mb-3 text-center">
              Other Players
            </h3>
            <div className="flex flex-col gap-1.5">
              {remaining.map((entry) => (
                <div
                  key={entry.player.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5"
                >
                  <span className="font-mono text-xs text-white/30 w-6 text-center">
                    #{entry.rank}
                  </span>
                  <Avatar
                    name={entry.player.name}
                    color={entry.player.color}
                    size="sm"
                    isBot={entry.player.isBot}
                  />
                  <span className="flex-1 font-body text-sm text-white/70 truncate">
                    {entry.player.name}
                  </span>
                  <span className="font-mono text-xs text-white/50 font-bold">
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Play Again button */}
      <div className="mt-6 animate-fade-in" style={{ animationDelay: '1.5s', animationFillMode: 'both' }}>
        <Button
          variant="primary"
          size="lg"
          onClick={onPlayAgain}
          className="animate-pulse-glow"
        >
          <span className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Play Again
          </span>
        </Button>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes confettiDrop {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes confettiSpin {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
        @keyframes podiumPlayerReveal {
          0% { transform: translateY(20px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default FinalPodium;
