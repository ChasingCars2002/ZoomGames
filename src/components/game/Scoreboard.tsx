import React, { useEffect, useState } from 'react';
import { Player } from '../../types';
import Avatar from '../ui/Avatar';

interface ScoreboardProps {
  scores: Record<string, number>;
  players: Player[];
  currentPlayerId: string;
}

interface ScoreEntry {
  player: Player;
  score: number;
  rank: number;
}

const AnimatedScore: React.FC<{ target: number }> = ({ target }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setDisplay(0);
      return;
    }

    const duration = 600;
    const start = display;
    const diff = target - start;
    const startTime = performance.now();

    const step = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
    // We intentionally only animate when target changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return <span>{display.toLocaleString()}</span>;
};

const rankColors: Record<number, { bg: string; text: string; border: string; glow: string }> = {
  1: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-400/30',
    glow: 'shadow-[0_0_12px_rgba(234,179,8,0.3)]',
  },
  2: {
    bg: 'bg-gray-300/10',
    text: 'text-gray-300',
    border: 'border-gray-300/30',
    glow: 'shadow-[0_0_12px_rgba(209,213,219,0.2)]',
  },
  3: {
    bg: 'bg-amber-600/10',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_12px_rgba(217,119,6,0.2)]',
  },
};

const rankEmojis: Record<number, string> = {
  1: '\uD83E\uDD47',
  2: '\uD83E\uDD48',
  3: '\uD83E\uDD49',
};

const Scoreboard: React.FC<ScoreboardProps> = ({
  scores,
  players,
  currentPlayerId,
}) => {
  const entries: ScoreEntry[] = players
    .map((player) => ({
      player,
      score: scores[player.id] ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-display text-sm text-white/60 uppercase tracking-wider px-2 mb-2">
        Scoreboard
      </h3>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const isCurrentPlayer = entry.player.id === currentPlayerId;
          const isTopThree = entry.rank <= 3;
          const colors = rankColors[entry.rank];

          return (
            <div
              key={entry.player.id}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300',
                isTopThree && colors
                  ? `${colors.bg} border ${colors.border} ${colors.glow}`
                  : 'bg-white/5 border border-transparent',
                isCurrentPlayer && !isTopThree
                  ? '!border-neon-cyan/30 bg-neon-cyan/5'
                  : '',
                isCurrentPlayer && isTopThree
                  ? 'ring-2 ring-neon-cyan/40'
                  : '',
              ].join(' ')}
            >
              {/* Rank */}
              <div className="w-8 text-center shrink-0">
                {isTopThree ? (
                  <span className="text-lg">{rankEmojis[entry.rank]}</span>
                ) : (
                  <span className="font-mono text-sm text-white/40">
                    #{entry.rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <Avatar
                name={entry.player.name}
                color={entry.player.color}
                size="sm"
                isBot={entry.player.isBot}
              />

              {/* Name */}
              <span
                className={[
                  'flex-1 font-body text-sm truncate',
                  isCurrentPlayer
                    ? 'text-neon-cyan font-semibold'
                    : isTopThree && colors
                      ? colors.text
                      : 'text-white',
                ].join(' ')}
              >
                {entry.player.name}
                {isCurrentPlayer && (
                  <span className="text-white/40 ml-1">(You)</span>
                )}
              </span>

              {/* Score */}
              <span
                className={[
                  'font-mono text-sm font-bold tabular-nums',
                  isTopThree && colors
                    ? colors.text
                    : 'text-white/80',
                ].join(' ')}
              >
                <AnimatedScore target={entry.score} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Scoreboard;
