import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import {
  GameType,
  GameConfig,
  GamePhase,
  Player,
  PlayerAction,
  GameMessage,
} from '../types';
import {
  EngineState,
  EngineAction,
  engineReducer,
  createInitialState,
} from '../lib/engine/GameEngine';
import { useTransportContext } from './TransportContext';
import { useRoomContext } from './RoomContext';

// ---------------------------------------------------------------------------
// Sync payload type (matches GAME_STATE_SYNC message payload)
// ---------------------------------------------------------------------------

interface GameStateSyncPayload {
  phase: GamePhase;
  gameType: GameType | null;
  config: GameConfig;
  scores: Record<string, number>;
  currentRound: number;
  totalRounds: number;
  roundData: unknown;
  hostId: string;
  timeRemaining: number;
  players: Player[];
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface GameContextValue {
  engineState: EngineState;
  dispatch: React.Dispatch<EngineAction>;
  selectGame: (gameType: GameType) => void;
  startGame: (gameType: GameType, config: GameConfig) => void;
  playerAction: (action: PlayerAction) => void;
  endGame: () => void;
  returnToLobby: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TICK_INTERVAL_MS = 1000;
const STATE_SYNC_INTERVAL_MS = 1000;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const { transport } = useTransportContext();
  const { room, currentPlayerId, isHost } = useRoomContext();

  const roomCode = room?.code ?? '';
  const hostId = room?.hostId ?? '';

  const [engineState, dispatch] = useReducer(
    engineReducer,
    { roomCode, hostId },
    ({ roomCode: rc, hostId: hid }) => createInitialState(rc, hid),
  );

  // Keep refs for use in intervals / callbacks
  const engineStateRef = useRef(engineState);
  engineStateRef.current = engineState;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  // -----------------------------------------------------------------------
  // Sync engine state when room host / code changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (hostId && hostId !== engineStateRef.current.hostId) {
      dispatch({ type: 'TRANSFER_HOST', newHostId: hostId });
    }
  }, [hostId]);

  // -----------------------------------------------------------------------
  // Sync players from room into engine
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!room) return;

    // Add any new players that exist in room but not in engine
    for (const player of room.players) {
      if (!engineStateRef.current.players.some((p) => p.id === player.id)) {
        dispatch({ type: 'JOIN', player });
      }
    }

    // Remove any players that left the room
    for (const ep of engineStateRef.current.players) {
      if (!room.players.some((p) => p.id === ep.id)) {
        dispatch({ type: 'LEAVE', playerId: ep.id });
      }
    }
  }, [room?.players]);

  // -----------------------------------------------------------------------
  // selectGame (host only)
  // -----------------------------------------------------------------------
  const selectGame = useCallback(
    (gameType: GameType) => {
      if (!transport || !isHost) return;

      dispatch({ type: 'SELECT_GAME', gameType });

      transport.send({
        type: 'GAME_SELECT',
        payload: { gameType },
      });
    },
    [transport, isHost],
  );

  // -----------------------------------------------------------------------
  // startGame (host only)
  // -----------------------------------------------------------------------
  const startGame = useCallback(
    (gameType: GameType, config: GameConfig) => {
      if (!transport || !isHost) return;

      dispatch({ type: 'SELECT_GAME', gameType });
      dispatch({ type: 'UPDATE_CONFIG', config });
      dispatch({ type: 'START_GAME' });

      transport.send({
        type: 'GAME_START',
        payload: { gameType, config },
      });
    },
    [transport, isHost],
  );

  // -----------------------------------------------------------------------
  // playerAction
  // -----------------------------------------------------------------------
  const playerAction = useCallback(
    (action: PlayerAction) => {
      if (!transport || !currentPlayerId) return;

      if (isHost) {
        // Host processes action locally
        dispatch({ type: 'PLAYER_ACTION', playerId: currentPlayerId, action });
      } else {
        // Non-host sends action to host via transport
        transport.send({
          type: 'PLAYER_ACTION',
          payload: { playerId: currentPlayerId, action },
        });
      }
    },
    [transport, currentPlayerId, isHost],
  );

  // -----------------------------------------------------------------------
  // endGame (host only)
  // -----------------------------------------------------------------------
  const endGame = useCallback(() => {
    if (!transport || !isHost) return;

    dispatch({ type: 'END_GAME' });

    transport.send({
      type: 'GAME_END',
      payload: { finalScores: engineStateRef.current.scores },
    });
  }, [transport, isHost]);

  // -----------------------------------------------------------------------
  // returnToLobby (host only)
  // -----------------------------------------------------------------------
  const returnToLobby = useCallback(() => {
    if (!transport || !isHost) return;

    dispatch({ type: 'RESET' });

    transport.send({
      type: 'RETURN_TO_LOBBY',
      payload: {},
    });
  }, [transport, isHost]);

  // -----------------------------------------------------------------------
  // Helper: apply sync state from host
  // -----------------------------------------------------------------------
  const syncStateFromHost = useCallback(
    (payload: GameStateSyncPayload) => {
      const currentState = engineStateRef.current;

      // Update config
      if (payload.config) {
        dispatch({ type: 'UPDATE_CONFIG', config: payload.config });
      }

      // If host transferred
      if (payload.hostId && payload.hostId !== currentState.hostId) {
        dispatch({ type: 'TRANSFER_HOST', newHostId: payload.hostId });
      }

      // Sync game selection
      if (payload.gameType && payload.gameType !== currentState.selectedGame) {
        dispatch({ type: 'SELECT_GAME', gameType: payload.gameType });
      }

      // Sync players
      for (const player of payload.players) {
        if (!currentState.players.some((p) => p.id === player.id)) {
          dispatch({ type: 'JOIN', player });
        }
      }
      for (const ep of currentState.players) {
        if (!payload.players.some((p) => p.id === ep.id)) {
          dispatch({ type: 'LEAVE', playerId: ep.id });
        }
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Transport message listener
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!transport) return;

    const unsubscribe = transport.subscribe((message: GameMessage, _senderId: string) => {
      switch (message.type) {
        case 'GAME_SELECT': {
          if (!isHostRef.current) {
            dispatch({ type: 'SELECT_GAME', gameType: message.payload.gameType });
          }
          break;
        }

        case 'GAME_START': {
          const { gameType, config } = message.payload;
          if (!isHostRef.current) {
            dispatch({ type: 'SELECT_GAME', gameType });
            dispatch({ type: 'UPDATE_CONFIG', config });
            dispatch({ type: 'START_GAME' });
          }
          break;
        }

        case 'GAME_STATE_SYNC': {
          // Non-host receives authoritative state from host
          if (!isHostRef.current) {
            syncStateFromHost(message.payload);
          }
          break;
        }

        case 'ROUND_START': {
          if (!isHostRef.current) {
            dispatch({ type: 'START_ROUND', roundData: message.payload.data });
          }
          break;
        }

        case 'ROUND_END': {
          if (!isHostRef.current) {
            dispatch({
              type: 'END_ROUND',
              scores: message.payload.scores,
              roundData: message.payload.roundData,
            });
          }
          break;
        }

        case 'PLAYER_ACTION': {
          // Host receives actions from non-host players
          if (isHostRef.current) {
            dispatch({
              type: 'PLAYER_ACTION',
              playerId: message.payload.playerId,
              action: message.payload.action,
            });
          }
          break;
        }

        case 'GAME_END': {
          if (!isHostRef.current) {
            dispatch({ type: 'END_GAME' });
          }
          break;
        }

        case 'RETURN_TO_LOBBY': {
          if (!isHostRef.current) {
            dispatch({ type: 'RESET' });
          }
          break;
        }

        default:
          break;
      }
    });

    return unsubscribe;
  }, [transport, syncStateFromHost]);

  // -----------------------------------------------------------------------
  // Host: timer interval during ROUND_ACTIVE
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isHost) return;
    if (engineState.phase !== GamePhase.ROUND_ACTIVE) return;

    const interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isHost, engineState.phase]);

  // -----------------------------------------------------------------------
  // Host: broadcast GAME_STATE_SYNC periodically
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!transport || !isHost) return;

    const interval = setInterval(() => {
      const st = engineStateRef.current;
      transport.send({
        type: 'GAME_STATE_SYNC',
        payload: {
          phase: st.phase,
          gameType: st.gameType,
          config: st.config,
          scores: st.scores,
          currentRound: st.currentRound,
          totalRounds: st.totalRounds,
          roundData: st.roundData,
          hostId: st.hostId,
          timeRemaining: st.timeRemaining,
          players: st.players,
        },
      });
    }, STATE_SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [transport, isHost]);

  // -----------------------------------------------------------------------
  // Provide
  // -----------------------------------------------------------------------
  const value: GameContextValue = {
    engineState,
    dispatch,
    selectGame,
    startGame,
    playerAction,
    endGame,
    returnToLobby,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return ctx;
}

export default GameContext;
