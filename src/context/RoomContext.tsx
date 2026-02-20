import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Player, Room, Role, PLAYER_COLORS } from '../types';
import { GameMessage } from '../types';
import { useTransportContext } from './TransportContext';
import { sanitizeNickname } from '../lib/security/sanitize';
import { isValidRoomCode } from '../lib/security/roomCodes';

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface RoomContextValue {
  room: Room | null;
  currentPlayerId: string | null;
  isHost: boolean;
  createRoom: (code: string, nickname: string) => void;
  joinRoom: (code: string, nickname: string) => void;
  leaveRoom: () => void;
  kickPlayer: (id: string) => void;
  banPlayer: (id: string) => void;
  transferHost: (id: string) => void;
  toggleReady: () => void;
  addBot: (bot: Player) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 5000;
const DISCONNECT_THRESHOLD_MS = 15000;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface RoomProviderProps {
  children: ReactNode;
}

export function RoomProvider({ children }: RoomProviderProps) {
  const { transport } = useTransportContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  // Track last heartbeat timestamp per player
  const heartbeatsRef = useRef<Record<string, number>>({});

  // Derive isHost
  const isHost = Boolean(room && currentPlayerId && room.hostId === currentPlayerId);

  // Stable reference to room for use inside callbacks / intervals
  const roomRef = useRef(room);
  roomRef.current = room;

  const currentPlayerIdRef = useRef(currentPlayerId);
  currentPlayerIdRef.current = currentPlayerId;

  // ----- Helper: pick a color not yet taken -----
  const pickColor = useCallback((existingPlayers: Player[]): string => {
    const usedColors = new Set(existingPlayers.map((p) => p.color));
    return (
      PLAYER_COLORS.find((c) => !usedColors.has(c)) ??
      PLAYER_COLORS[existingPlayers.length % PLAYER_COLORS.length]
    );
  }, []);

  // ----- Helper: build a Player object -----
  const buildPlayer = useCallback(
    (id: string, nickname: string, role: Role, existingPlayers: Player[]): Player => ({
      id,
      name: sanitizeNickname(nickname),
      role,
      ready: false,
      connected: true,
      joinedAt: Date.now(),
      color: pickColor(existingPlayers),
      isBot: false,
    }),
    [pickColor],
  );

  // -----------------------------------------------------------------------
  // createRoom
  // -----------------------------------------------------------------------
  const createRoom = useCallback(
    (code: string, nickname: string) => {
      if (!transport) return;

      const hostPlayer = buildPlayer(transport.clientId, nickname, Role.HOST, []);

      const newRoom: Room = {
        code,
        hostId: transport.clientId,
        players: [hostPlayer],
        createdAt: Date.now(),
        maxPlayers: 10,
        bannedIds: [],
      };

      setRoom(newRoom);
      setCurrentPlayerId(transport.clientId);
      heartbeatsRef.current[transport.clientId] = Date.now();
    },
    [transport, buildPlayer],
  );

  // -----------------------------------------------------------------------
  // joinRoom
  // -----------------------------------------------------------------------
  const joinRoom = useCallback(
    (code: string, nickname: string) => {
      if (!transport) return;
      if (!isValidRoomCode(code)) return;

      const player = buildPlayer(transport.clientId, nickname, Role.PLAYER, []);

      setCurrentPlayerId(transport.clientId);
      heartbeatsRef.current[transport.clientId] = Date.now();

      // Announce join to other tabs / peers
      transport.send({
        type: 'PLAYER_JOIN',
        payload: { player },
      });

      // Start with a minimal room; we will receive GAME_STATE_SYNC or
      // PLAYER_JOIN responses from the host to fill in the real state.
      setRoom((prev) => {
        if (prev) {
          // Already have room state (e.g. received sync before join resolved)
          return {
            ...prev,
            players: prev.players.some((p) => p.id === player.id)
              ? prev.players
              : [...prev.players, player],
          };
        }
        return {
          code,
          hostId: '', // will be set via sync
          players: [player],
          createdAt: Date.now(),
          maxPlayers: 10,
          bannedIds: [],
        };
      });
    },
    [transport, buildPlayer],
  );

  // -----------------------------------------------------------------------
  // leaveRoom
  // -----------------------------------------------------------------------
  const leaveRoom = useCallback(() => {
    if (!transport || !currentPlayerId) return;

    transport.send({
      type: 'PLAYER_LEAVE',
      payload: { playerId: currentPlayerId },
    });

    setRoom(null);
    setCurrentPlayerId(null);
    heartbeatsRef.current = {};
  }, [transport, currentPlayerId]);

  // -----------------------------------------------------------------------
  // kickPlayer
  // -----------------------------------------------------------------------
  const kickPlayer = useCallback(
    (id: string) => {
      if (!transport || !isHost) return;

      transport.send({
        type: 'HOST_KICK',
        payload: { targetId: id },
      });

      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter((p) => p.id !== id),
        };
      });
    },
    [transport, isHost],
  );

  // -----------------------------------------------------------------------
  // banPlayer
  // -----------------------------------------------------------------------
  const banPlayer = useCallback(
    (id: string) => {
      if (!transport || !isHost) return;

      transport.send({
        type: 'HOST_BAN',
        payload: { targetId: id },
      });

      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter((p) => p.id !== id),
          bannedIds: [...prev.bannedIds, id],
        };
      });
    },
    [transport, isHost],
  );

  // -----------------------------------------------------------------------
  // transferHost
  // -----------------------------------------------------------------------
  const transferHost = useCallback(
    (id: string) => {
      if (!transport || !isHost) return;

      transport.send({
        type: 'HOST_TRANSFER',
        payload: { newHostId: id },
      });

      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          hostId: id,
          players: prev.players.map((p) => {
            if (p.id === id) return { ...p, role: Role.HOST };
            if (p.id === prev.hostId) return { ...p, role: Role.PLAYER };
            return p;
          }),
        };
      });
    },
    [transport, isHost],
  );

  // -----------------------------------------------------------------------
  // toggleReady
  // -----------------------------------------------------------------------
  const toggleReady = useCallback(() => {
    if (!transport || !currentPlayerId) return;

    setRoom((prev) => {
      if (!prev) return prev;
      const me = prev.players.find((p) => p.id === currentPlayerId);
      if (!me) return prev;

      const newReady = !me.ready;

      transport.send({
        type: 'PLAYER_READY',
        payload: { playerId: currentPlayerId, ready: newReady },
      });

      return {
        ...prev,
        players: prev.players.map((p) =>
          p.id === currentPlayerId ? { ...p, ready: newReady } : p,
        ),
      };
    });
  }, [transport, currentPlayerId]);

  // -----------------------------------------------------------------------
  // addBot (host only)
  // -----------------------------------------------------------------------
  const addBot = useCallback(
    (bot: Player) => {
      setRoom((prev) => {
        if (!prev) return prev;
        if (prev.players.some((p) => p.id === bot.id)) return prev;
        return {
          ...prev,
          players: [...prev.players, bot],
        };
      });
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Transport message listener
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!transport) return;

    const unsubscribe = transport.subscribe((message: GameMessage, senderId: string) => {
      switch (message.type) {
        case 'PLAYER_JOIN': {
          const joiningPlayer = message.payload.player;

          // Reject banned players
          if (roomRef.current?.bannedIds.includes(joiningPlayer.id)) return;

          heartbeatsRef.current[joiningPlayer.id] = Date.now();

          setRoom((prev) => {
            if (!prev) return prev;
            if (prev.players.some((p) => p.id === joiningPlayer.id)) {
              // Mark reconnected
              return {
                ...prev,
                players: prev.players.map((p) =>
                  p.id === joiningPlayer.id ? { ...p, connected: true } : p,
                ),
              };
            }
            return {
              ...prev,
              players: [...prev.players, { ...joiningPlayer, connected: true }],
            };
          });
          break;
        }

        case 'PLAYER_LEAVE': {
          const { playerId } = message.payload;
          delete heartbeatsRef.current[playerId];

          setRoom((prev) => {
            if (!prev) return prev;
            const remaining = prev.players.filter((p) => p.id !== playerId);
            if (remaining.length === 0) return null;

            let newHostId = prev.hostId;
            let updatedPlayers = remaining;

            if (playerId === prev.hostId) {
              // Transfer host to earliest joined player
              const sorted = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt);
              newHostId = sorted[0].id;
              updatedPlayers = remaining.map((p) =>
                p.id === newHostId ? { ...p, role: Role.HOST } : p,
              );
            }

            return { ...prev, hostId: newHostId, players: updatedPlayers };
          });
          break;
        }

        case 'PLAYER_READY': {
          const { playerId, ready } = message.payload;
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.id === playerId ? { ...p, ready } : p,
              ),
            };
          });
          break;
        }

        case 'HOST_KICK': {
          const { targetId } = message.payload;

          // If we are the kicked player, leave the room
          if (targetId === currentPlayerIdRef.current) {
            setRoom(null);
            setCurrentPlayerId(null);
            heartbeatsRef.current = {};
            return;
          }

          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.filter((p) => p.id !== targetId),
            };
          });
          break;
        }

        case 'HOST_BAN': {
          const { targetId } = message.payload;

          if (targetId === currentPlayerIdRef.current) {
            setRoom(null);
            setCurrentPlayerId(null);
            heartbeatsRef.current = {};
            return;
          }

          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.filter((p) => p.id !== targetId),
              bannedIds: [...prev.bannedIds, targetId],
            };
          });
          break;
        }

        case 'HOST_TRANSFER': {
          const { newHostId } = message.payload;
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              hostId: newHostId,
              players: prev.players.map((p) => {
                if (p.id === newHostId) return { ...p, role: Role.HOST };
                if (p.id === prev.hostId) return { ...p, role: Role.PLAYER };
                return p;
              }),
            };
          });
          break;
        }

        case 'HEARTBEAT': {
          const { playerId, timestamp } = message.payload;
          heartbeatsRef.current[playerId] = timestamp;
          break;
        }

        default:
          break;
      }
    });

    return unsubscribe;
  }, [transport]);

  // -----------------------------------------------------------------------
  // Heartbeat sender
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!transport || !currentPlayerId) return;

    const interval = setInterval(() => {
      transport.send({
        type: 'HEARTBEAT',
        payload: { playerId: currentPlayerId, timestamp: Date.now() },
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [transport, currentPlayerId]);

  // -----------------------------------------------------------------------
  // Disconnect detector (host only)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!transport || !room || !isHost) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const currentRoom = roomRef.current;
      if (!currentRoom) return;

      let roomChanged = false;
      let updatedPlayers = currentRoom.players;
      let newHostId = currentRoom.hostId;

      for (const player of currentRoom.players) {
        if (player.id === currentPlayerIdRef.current) continue; // skip self

        const lastHeartbeat = heartbeatsRef.current[player.id] ?? 0;
        const elapsed = now - lastHeartbeat;

        if (elapsed > DISCONNECT_THRESHOLD_MS && player.connected) {
          // Mark as disconnected
          updatedPlayers = updatedPlayers.map((p) =>
            p.id === player.id ? { ...p, connected: false } : p,
          );
          roomChanged = true;

          // If the disconnected player was somehow the host, transfer
          if (player.id === newHostId) {
            const connected = updatedPlayers
              .filter((p) => p.connected)
              .sort((a, b) => a.joinedAt - b.joinedAt);
            if (connected.length > 0) {
              newHostId = connected[0].id;
              updatedPlayers = updatedPlayers.map((p) => {
                if (p.id === newHostId) return { ...p, role: Role.HOST };
                if (p.id === currentRoom.hostId) return { ...p, role: Role.PLAYER };
                return p;
              });
            }
          }
        }
      }

      if (roomChanged) {
        setRoom((prev) => {
          if (!prev) return prev;
          return { ...prev, hostId: newHostId, players: updatedPlayers };
        });
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [transport, room, isHost]);

  // -----------------------------------------------------------------------
  // Provide
  // -----------------------------------------------------------------------
  const value: RoomContextValue = {
    room,
    currentPlayerId,
    isHost,
    createRoom,
    joinRoom,
    leaveRoom,
    kickPlayer,
    banPlayer,
    transferHost,
    toggleReady,
    addBot,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error('useRoomContext must be used within a RoomProvider');
  }
  return ctx;
}

export default RoomContext;
