import React from 'react';
import Button from '../ui/Button';

interface HostControlsProps {
  canStart: boolean;
  onStart: () => void;
  onAddBot: () => void;
  playerCount: number;
}

const HostControls: React.FC<HostControlsProps> = ({
  canStart,
  onStart,
  onAddBot,
  playerCount,
}) => {
  const needMorePlayers = playerCount < 2;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Start Game Button */}
      <Button
        variant="primary"
        size="lg"
        onClick={onStart}
        disabled={!canStart}
        className={[
          'w-full max-w-xs text-center',
          canStart ? 'animate-pulse-glow' : '',
        ].join(' ')}
      >
        <span className="flex items-center justify-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Start Game
        </span>
      </Button>

      {/* Insufficient players message */}
      {needMorePlayers && (
        <p className="font-body text-sm text-neon-pink flex items-center gap-1.5 animate-fade-in">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Need at least 2 players to start
        </p>
      )}

      {/* Add Bot Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddBot}
        className="flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <line x1="12" y1="7" x2="12" y2="11" />
          <circle cx="8" cy="16" r="1" />
          <circle cx="16" cy="16" r="1" />
        </svg>
        Add Bot
      </Button>
    </div>
  );
};

export default HostControls;
