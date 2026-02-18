import React from 'react';
import { GameType } from '../../types';
import { GAME_LIST } from '../../constants/games';
import Carousel from '../ui/Carousel';

interface GameSelectorProps {
  selectedGame: GameType | null;
  onSelect: (gameType: GameType) => void;
  disabled?: boolean;
}

const GameCard: React.FC<{
  emoji: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}> = ({ emoji, name, description, minPlayers, maxPlayers }) => {
  return (
    <div className="w-[200px] p-4 text-left">
      <div className="text-4xl mb-3">{emoji}</div>
      <h3 className="font-display text-base text-white mb-1">{name}</h3>
      <p className="font-body text-xs text-white/50 mb-3 line-clamp-2 leading-relaxed">
        {description}
      </p>
      <div className="flex items-center gap-1.5">
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
          className="text-white/40"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="font-body text-xs text-white/40">
          {minPlayers}-{maxPlayers} players
        </span>
      </div>
    </div>
  );
};

const GameSelector: React.FC<GameSelectorProps> = ({
  selectedGame,
  onSelect,
  disabled = false,
}) => {
  const carouselItems = GAME_LIST.map((game) => ({
    id: game.type,
    content: (
      <GameCard
        emoji={game.emoji}
        name={game.name}
        description={game.description}
        minPlayers={game.minPlayers}
        maxPlayers={game.maxPlayers}
      />
    ),
  }));

  const handleSelect = (id: string) => {
    if (disabled) return;
    onSelect(id as GameType);
  };

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <h3 className="font-display text-sm text-white/60 uppercase tracking-wider px-2 mb-3">
        Choose a Game
      </h3>
      <Carousel
        items={carouselItems}
        selectedId={selectedGame ?? undefined}
        onSelect={handleSelect}
      />
    </div>
  );
};

export default GameSelector;
