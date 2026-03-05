import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase } from './types';
import { TransportProvider } from './context/TransportContext';
import { RoomProvider } from './context/RoomContext';
import { GameProvider, useGameContext } from './context/GameContext';
import { useRoomContext } from './context/RoomContext';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultsPage from './pages/ResultsPage';

type Screen = 'home' | 'lobby' | 'game' | 'results';

function phaseToScreen(phase: GamePhase): Screen {
  switch (phase) {
    case GamePhase.IDLE:
    case GamePhase.LOBBY:
      return 'lobby';
    case GamePhase.GAME_STARTING:
    case GamePhase.ROUND_STARTING:
    case GamePhase.ROUND_ACTIVE:
    case GamePhase.ROUND_ENDING:
    case GamePhase.GAME_ENDING:
      return 'game';
    case GamePhase.RESULTS:
      return 'results';
    default:
      return 'lobby';
  }
}

interface InnerAppProps {
  onLeaveRoom: () => void;
}

const InnerApp: React.FC<InnerAppProps> = ({ onLeaveRoom }) => {
  const { engineState } = useGameContext();
  const { room } = useRoomContext();
  const [screen, setScreen] = useState<Screen>('lobby');
  const [transitioning, setTransitioning] = useState(false);
  const hadRoomRef = useRef(false);

  useEffect(() => {
    const targetScreen = phaseToScreen(engineState.phase);
    if (targetScreen !== screen) {
      setTransitioning(true);
      const timer = setTimeout(() => {
        setScreen(targetScreen);
        requestAnimationFrame(() => { setTransitioning(false); });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [engineState.phase]);

  // Track if we ever had a room
  useEffect(() => {
    if (room) { hadRoomRef.current = true; }
  }, [room]);

  // Only leave if room was previously set and is now null (kicked/banned/left)
  useEffect(() => {
    if (!room && hadRoomRef.current) {
      onLeaveRoom();
    }
  }, [room, onLeaveRoom]);

  const transitionClasses = transitioning
    ? 'opacity-0 translate-y-2'
    : 'opacity-100 translate-y-0';

  return (
    <div
      className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${transitionClasses}`}
    >
      {screen === 'lobby' && <LobbyPage />}
      {screen === 'game' && <GamePage />}
      {screen === 'results' && <ResultsPage />}
    </div>
  );
};

const RoomInitializer: React.FC<{ roomCode: string }> = ({ roomCode }) => {
  const { createRoom, joinRoom } = useRoomContext();
  const { isTransportReady } = React.useContext(
    React.createContext({ isTransportReady: false })
  );
  const initializedRef = React.useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const nickname = sessionStorage.getItem('zg_nickname') ?? 'Player';
    const action = sessionStorage.getItem('zg_action');
    if (action === 'create') {
      createRoom(nickname);
    } else if (action === 'join') {
      const code = sessionStorage.getItem('zg_room_code') ?? roomCode;
      joinRoom(code, nickname);
    }
  }, []);

  return null;
};

const App: React.FC = () => {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [homeVisible, setHomeVisible] = useState(true);

  const handleCreateRoom = useCallback((nickname: string) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setHomeVisible(false);
    setTimeout(() => { setIsHost(true); setRoomCode(code); }, 300);
    sessionStorage.setItem('zg_nickname', nickname);
    sessionStorage.setItem('zg_action', 'create');
  }, []);

  const handleJoinRoom = useCallback((code: string, nickname: string) => {
    setHomeVisible(false);
    setTimeout(() => { setIsHost(false); setRoomCode(code.toUpperCase()); }, 300);
    sessionStorage.setItem('zg_nickname', nickname);
    sessionStorage.setItem('zg_action', 'join');
    sessionStorage.setItem('zg_room_code', code.toUpperCase());
  }, []);

  const handleLeaveRoom = useCallback(() => {
    setRoomCode(null);
    setIsHost(false);
    sessionStorage.removeItem('zg_nickname');
    sessionStorage.removeItem('zg_action');
    sessionStorage.removeItem('zg_room_code');
    setTimeout(() => { setHomeVisible(true); }, 100);
  }, []);

  return (
    <AppShell>
      {!roomCode ? (
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
            homeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <HomePage onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
        </div>
      ) : (
        <TransportProvider roomCode={roomCode} isHost={isHost}>
          <RoomProvider>
            <GameProvider>
              <RoomInitializer roomCode={roomCode} />
              <InnerApp onLeaveRoom={handleLeaveRoom} />
            </GameProvider>
          </RoomProvider>
        </TransportProvider>
      )}
    </AppShell>
  );
};

export default App;
