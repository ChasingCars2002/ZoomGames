import React, { useState, useCallback } from 'react';
import Badge from '../ui/Badge';

interface HeaderProps {
  roomCode?: string;
  playerCount?: number;
  gameName?: string;
  onLogoClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  roomCode,
  playerCount,
  gameName,
  onLogoClick,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = useCallback(async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = roomCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [roomCode]);

  return (
    <header className="h-14 bg-navy-800/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 shrink-0">
      {/* Left: Logo */}
      <button
        onClick={onLogoClick}
        className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan rounded-lg px-1"
      >
        <span className="text-2xl" aria-hidden="true">
          🎮
        </span>
        <span className="font-display text-xl text-neon-yellow text-glow-yellow tracking-wide group-hover:scale-105 transition-transform duration-200">
          ZoomGames
        </span>
      </button>

      {/* Center: Game name */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block">
        {gameName && (
          <span className="font-display text-lg text-white text-glow-cyan">
            {gameName}
          </span>
        )}
      </div>

      {/* Right: Room code + player count */}
      <div className="flex items-center gap-3">
        {roomCode && (
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600 rounded-lg px-3 py-1.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan group"
            title="Click to copy room code"
          >
            <span className="font-mono text-sm text-white/60 select-none">
              ROOM
            </span>
            <span className="font-mono text-sm text-neon-cyan font-bold tracking-widest">
              {roomCode}
            </span>
            {/* Copy icon */}
            <span className="text-white/40 group-hover:text-white/70 transition-colors">
              {copied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#39ff14"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
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
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </span>
          </button>
        )}

        {playerCount !== undefined && (
          <Badge variant="player">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {playerCount}
          </Badge>
        )}
      </div>
    </header>
  );
};

export default Header;
