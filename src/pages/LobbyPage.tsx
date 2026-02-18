import React, { useState, useCallback, useMemo } from 'react';
import { useRoomContext } from '../context/RoomContext';
import { useGameContext } from '../context/GameContext';
import { GameConfig, GameType, Role, PLAYER_COLORS } from '../types';
import { GAME_MAP } from '../constants/games';
import Header from '../components/layout/Header';
import PlayerList from '../components/room/PlayerList';
import GameSelector from '../components/room/GameSelector';
import RoomSettings from '../components/room/RoomSettings';
import HostControls from '../components/room/HostControls';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useCopyToClipboard } from '../hooks/useClipboard';

// ---------------------------------------------------------------------------
// Bot name generator
// ---------------------------------------------------------------------------

const BOT_NAMES = [
  'RoboPlayer',
  'BotBuddy',
  'CyberPal',
  'AutoFriend',
  'PixelBot',
  'NeonDroid',
  'ByteBot',
  'CircuitPal',
  'LaserBot',
  'TurboAI',
];

let botCounter = 0;

function generateBotName(): string {
  const name = BOT_NAMES[botCounter % BOT_NAMES.length];
  botCounter++;
  return `${name}${botCounter > BOT_NAMES.length ? botCounter : ''}`;
}

// ---------------------------------------------------------------------------
// LobbyPage
// ---------------------------------------------------------------------------

const LobbyPage: React.FC = () => {
  const {
    room,
    currentPlayerId,
    isHost,
    kickPlayer,
    banPlayer,
    toggleReady,
  } = useRoomContext();

  const {
    engineState,
    selectGame,
    startGame,
    dispatch,
  } = useGameContext();

  const { copy, copied } = useCopyToClipboard();

  const [config, setConfig] = useState<GameConfig>(engineState.config);

  // Derive values
  const players = room?.players ?? [];
  const hostId = room?.hostId ?? '';
  const roomCode = room?.code ?? '';
  const selectedGame = engineState.selectedGame;
  const playerCount = players.length;

  // Current player
  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId),
    [players, currentPlayerId]
  );

  // Can start: at least 2 players ready and a game is selected
  const readyPlayers = useMemo(
    () => players.filter((p) => p.ready || p.id === hostId),
    [players, hostId]
  );

  const canStart = useMemo(() => {
    const hasGame = selectedGame !== null;
    const enoughReady = readyPlayers.length >= 2;
    return hasGame && enoughReady;
  }, [selectedGame, readyPlayers]);

  // Game name for header
  const gameName = selectedGame ? GAME_MAP[selectedGame]?.name : undefined;

  // Handle game selection
  const handleSelectGame = useCallback(
    (gameType: GameType) => {
      selectGame(gameType);
    },
    [selectGame]
  );

  // Handle config change
  const handleConfigChange = useCallback(
    (newConfig: GameConfig) => {
      setConfig(newConfig);
      dispatch({ type: 'UPDATE_CONFIG', config: newConfig });
    },
    [dispatch]
  );

  // Handle start game
  const handleStartGame = useCallback(() => {
    if (!selectedGame) return;
    startGame(selectedGame, config);
  }, [selectedGame, config, startGame]);

  // Handle add bot
  const handleAddBot = useCallback(() => {
    if (!room) return;

    const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const usedColors = new Set(players.map((p) => p.color));
    const color =
      PLAYER_COLORS.find((c) => !usedColors.has(c)) ??
      PLAYER_COLORS[players.length % PLAYER_COLORS.length];

    const botPlayer = {
      id: botId,
      name: generateBotName(),
      role: Role.PLAYER as Role,
      ready: true,
      connected: true,
      joinedAt: Date.now(),
      color,
      isBot: true,
    };

    dispatch({ type: 'JOIN', player: botPlayer });
  }, [room, players, dispatch]);

  // Handle copy room code
  const handleCopyCode = useCallback(() => {
    if (roomCode) {
      copy(roomCode);
    }
  }, [roomCode, copy]);

  // Handle kick/ban
  const handleKick = useCallback(
    (playerId: string) => {
      kickPlayer(playerId);
      dispatch({ type: 'KICK_PLAYER', playerId });
    },
    [kickPlayer, dispatch]
  );

  const handleBan = useCallback(
    (playerId: string) => {
      banPlayer(playerId);
      dispatch({ type: 'KICK_PLAYER', playerId });
    },
    [banPlayer, dispatch]
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <Header roomCode={roomCode} playerCount={playerCount} gameName={gameName} />

      {/* Room code banner */}
      <div className="flex items-center justify-center gap-3 py-3">
        <span className="font-body text-white/50 text-sm">Room Code:</span>
        <span
          className="font-display text-2xl text-neon-yellow tracking-widest"
          style={{ textShadow: '0 0 10px rgba(245, 230, 66, 0.4)' }}
        >
          {roomCode}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopyCode}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 px-4 pb-4 overflow-hidden">
        {/* Left side: Game Selector + Settings */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          <Card glow="cyan" className="p-4">
            <h3 className="font-display text-lg text-white mb-3">Select Game</h3>
            <GameSelector
              selectedGame={selectedGame}
              onSelect={handleSelectGame}
              disabled={!isHost}
            />
          </Card>

          {isHost && (
            <Card glow="none" className="p-4">
              <h3 className="font-display text-lg text-white mb-3">Room Settings</h3>
              <RoomSettings config={config} onChange={handleConfigChange} disabled={!isHost} />
            </Card>
          )}
        </div>

        {/* Right side: Player List */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          <Card glow="none" className="flex-1 p-4 overflow-y-auto">
            <h3 className="font-display text-lg text-white mb-3">
              Players ({playerCount})
            </h3>
            <PlayerList
              players={players}
              currentPlayerId={currentPlayerId ?? ''}
              hostId={hostId}
              onKick={isHost ? handleKick : undefined}
              onBan={isHost ? handleBan : undefined}
            />
          </Card>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="px-4 pb-4">
        <Card glow="none" className="p-4">
          <div className="flex flex-col items-center gap-3">
            {/* Ready button (for non-hosts) */}
            <div className="flex items-center gap-3">
              <Button
                variant={currentPlayer?.ready ? 'danger' : 'secondary'}
                size="md"
                onClick={toggleReady}
              >
                {currentPlayer?.ready ? 'Not Ready' : 'Ready Up'}
              </Button>
            </div>

            {/* Host controls */}
            {isHost ? (
              <HostControls
                canStart={canStart}
                onStart={handleStartGame}
                onAddBot={handleAddBot}
                playerCount={playerCount}
              />
            ) : (
              <p className="font-body text-sm text-white/40 animate-pulse">
                Waiting for host to start...
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LobbyPage;
