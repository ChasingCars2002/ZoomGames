import React from 'react';
import { Player, Role } from '../../types';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string;
  hostId: string;
  onKick?: (playerId: string) => void;
  onBan?: (playerId: string) => void;
}

function roleToBadgeVariant(role: Role, isBot: boolean): 'host' | 'player' | 'spectator' | 'bot' {
  if (isBot) return 'bot';
  switch (role) {
    case Role.HOST:
      return 'host';
    case Role.SPECTATOR:
      return 'spectator';
    default:
      return 'player';
  }
}

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  currentPlayerId,
  hostId,
  onKick,
  onBan,
}) => {
  const isCurrentHost = currentPlayerId === hostId;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-display text-sm text-white/60 uppercase tracking-wider px-2 mb-2">
        Players ({players.length})
      </h3>
      <div className="flex flex-col gap-1.5">
        {players.map((player) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const isHost = player.id === hostId;
          const showActions = isCurrentHost && !isCurrentPlayer && !isHost;

          return (
            <div
              key={player.id}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300',
                'animate-fade-in',
                isCurrentPlayer
                  ? 'bg-neon-cyan/10 border border-neon-cyan/20'
                  : 'bg-white/5 border border-transparent hover:bg-white/[0.07]',
                !player.connected ? 'opacity-50' : '',
              ].join(' ')}
            >
              {/* Avatar */}
              <Avatar
                name={player.name}
                color={player.color}
                size="sm"
                isBot={player.isBot}
              />

              {/* Name and badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'font-body text-sm truncate',
                      isCurrentPlayer ? 'text-neon-cyan font-semibold' : 'text-white',
                    ].join(' ')}
                  >
                    {player.name}
                    {isCurrentPlayer && (
                      <span className="text-white/40 ml-1">(You)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Role badge */}
              <Badge variant={roleToBadgeVariant(isHost ? Role.HOST : player.role, player.isBot)} />

              {/* Ready status */}
              <Badge variant={player.ready ? 'ready' : 'not-ready'} />

              {/* Host actions */}
              {showActions && (
                <div className="flex items-center gap-1 ml-1">
                  {onKick && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onKick(player.id)}
                      className="!px-2 !py-1 text-xs"
                      title="Kick player"
                    >
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
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <line x1="17" y1="11" x2="22" y2="11" />
                      </svg>
                    </Button>
                  )}
                  {onBan && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onBan(player.id)}
                      className="!px-2 !py-1 text-xs"
                      title="Ban player"
                    >
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
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerList;
