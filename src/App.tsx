import React, { useState, useEffect, useCallback } from 'react';
import { GamePhase } from './types';
import { TransportProvider, useTransportContext } from './context/TransportContext';
import { RoomProvider } from './context/RoomContext';
import { GameProvider, useGameContext } from './context/GameContext';
import { useRoomContext } from './context/RoomContext';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultsPage from './pages/ResultsPage';

// ---------------------------------------------------------------------------
// Screen type
// ---------------------------------------------------------------------------

type Screen = 'home' | 'lobby' | 'game' | 'results';

// ---------------------------------------------------------------------------
// Phase-to-screen mapping
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Inner app (inside providers, has access to contexts)
// ---------------------------------------------------------------------------

interface InnerAppProps {
  onLeaveRoom: () => void;
}

const InnerApp: React.FC<InnerAppProps> = ({ onLeaveRoom }) => {
  const { engineState } = useGameContext();
  const { room } = useRoomContext();
  const [screen, setScreen] = useState<Screen>('lobby');
  const [transitioning, setTransitioning] = useState(false);

  // Watch engine phase and auto-navigate
  useEffect(() => {
    const targetScreen = phaseToScreen(engineState.phase);

    if (targetScreen !== screen) {
      // Begin transition out
      setTransitioning(true);

      const timer = setTimeout(() => {
        setScreen(targetScreen);
        // Small delay before fading in
        requestAnimationFrame(() => {
          setTransitioning(false);
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [engineState.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // If room is null (user got kicked/banned), go back to home
  useEffect(() => {
    if (!room) {
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

// ---------------------------------------------------------------------------
// RoomInitializer: reads session storage and calls createRoom/joinRoom once
// ---------------------------------------------------------------------------

const RoomInitializer: React.FC<{ roomCode: string }> = ({ roomCode }) => {
  const { createRoom, joinRoom } = useRoomContext();
  const { transport } = useTransportContext();
  const initializedRef = React.useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!transport) return; // Wait until transport is ready

    initializedRef.current = true;

    const nickname = sessionStorage.getItem('zg_nickname') ?? 'Player';
    const action = sessionStorage.getItem('zg_action');

    if (action === 'create') {
      createRoom(roomCode, nickname);
    } else if (action === 'join') {
      const code = sessionStorage.getItem('zg_room_code') ?? roomCode;
      joinRoom(code, nickname);
    }
  }, [transport, createRoom, joinRoom, roomCode]);

  return null;
};

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

const App: React.FC = () => {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [homeVisible, setHomeVisible] = useState(true);

  // Handle creating a room
  const handleCreateRoom = useCallback((nickname: string) => {
    // Generate a room code for TransportProvider
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    setHomeVisible(false);
    setTimeout(() => {
      setRoomCode(code);
    }, 300);

    // Store nickname temporarily so RoomInitializer can use it
    sessionStorage.setItem('zg_nickname', nickname);
    sessionStorage.setItem('zg_action', 'create');
  }, []);

  // Handle joining a room
  const handleJoinRoom = useCallback((code: string, nickname: string) => {
    setHomeVisible(false);
    setTimeout(() => {
      setRoomCode(code.toUpperCase());
    }, 300);

    sessionStorage.setItem('zg_nickname', nickname);
    sessionStorage.setItem('zg_action', 'join');
    sessionStorage.setItem('zg_room_code', code.toUpperCase());
  }, []);

  // Handle leaving back to home
  const handleLeaveRoom = useCallback(() => {
    setRoomCode(null);
    sessionStorage.removeItem('zg_nickname');
    sessionStorage.removeItem('zg_action');
    sessionStorage.removeItem('zg_room_code');

    setTimeout(() => {
      setHomeVisible(true);
    }, 100);
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
        <TransportProvider roomCode={roomCode}>
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
