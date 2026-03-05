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
import { PeerJSTransport } from '../lib/transport/PeerJSTransport';
import { sanitizeNickname } from '../lib/security/sanitize';
import { generateRoomCode, isValidRoomCode } from '../lib/security/roomCodes';

interface RoomContextValue {
  room: Room | null;
  currentPlayerId: string | null;
  isHost: boolean;
  createRoom: (nickname: string) => void;
  joinRoom: (code: string, nickname: string) => void;
  leaveRoom: () => void;
  kickPlayer: (id: string) => void;
  banPlayer: (id: string) => void;
  transferHost: (id: string) => void;
  toggleReady: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

const HEARTBEAT_INTERVAL_MS = 5000;
const DISCONNECT_THRESHOLD_MS = 15000;

interface RoomProviderProps { children: ReactNode; }

export function RoomProvider({ children }: RoomProviderProps) {
  const { transport, isTransportReady } = useTransportContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const heartbeatsRef = useRef<Record<string, number>>({});

  const isHost = Boolean(room && currentPlayerId && room.hostId === currentPlayerId);
  const roomRef = useRef(room);
  roomRef.current = room;
  const currentPlayerIdRef = useRef(currentPlayerId);
  currentPlayerIdRef.current = currentPlayerId;

  const pickColor = useCallback((existingPlayers: Player[]): string => {
    const usedColors = new Set(existingPlayers.map((p) => p.color));
    return PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[existingPlayers.length % PLAYER_COLORS.length];
  }, []);

  const buildPlayer = useCallback(
    (id: string, nickname: string, role: Role, existingPlayers: Player[]): Player => ({
      id, name: sanitizeNickname(nickname), role, ready: false, connected: true, joinedAt: Date.now(), color: pickColor(existingPlayers), isBot: false,
    }), [pickColor],
  );

  const createRoom = useCallback((nickname: string) => {
    if (!transport) return;
    const code = generateRoomCode();
    const hostPlayer = buildPlayer(transport.clientId, nickname, Role.HOST, []);
    const newRoom: Room = { code, hostId: transport.clientId, players: [hostPlayer], createdAt: Date.now(), maxPlayers: 10, bannedIds: [] };
    setRoom(newRoom);
    setCurrentPlayerId(transport.clientId);
    heartbeatsRef.current[transport.clientId] = Date.now();
  }, [transport, buildPlayer]);

  const joinRoom = useCallback((code: string, nickname: string) => {
    if (!transport) return;
    if (!isValidRoomCode(code)) return;
    const player = buildPlayer(transport.clientId, nickname, Role.PLAYER, []);
    setCurrentPlayerId(transport.clientId);
    heartbeatsRef.current[transport.clientId] = Date.now();

    // PeerJS: connect to host peer, then announce join
    if (transport instanceof PeerJSTransport) {
      (transport as PeerJSTransport).connectToHost(code).then(() => {
        transport.send({ type: 'PLAYER_JOIN', payload: { player } });
      }).catch((err) => console.error('[RoomContext] connect failed', err));
    } else {
      transport.send({ type: 'PLAYER_JOIN', payload: { player } });
    }

    setRoom((prev) => {
      if (prev) {
        return { ...prev, players: prev.players.some((p) => p.id === player.id) ? prev.players : [...prev.players, player] };
      }
      return { code, hostId: code, players: [player], createdAt: Date.now(), maxPlayers: 10, bannedIds: [] };
    });
  }, [transport, buildPlayer]);

  const leaveRoom = useCallback(() => {
    if (!transport || !currentPlayerId) return;
    transport.send({ type: 'PLAYER_LEAVE', payload: { playerId: currentPlayerId } });
    setRoom(null); setCurrentPlayerId(null); heartbeatsRef.current = {};
  }, [transport, currentPlayerId]);

  const kickPlayer = useCallback((id: string) => {
    if (!transport || !isHost) return;
    transport.send({ type: 'HOST_KICK', payload: { targetId: id } });
    setRoom((prev) => prev ? { ...prev, players: prev.players.filter((p) => p.id !== id) } : prev);
  }, [transport, isHost]);

  const banPlayer = useCallback((id: string) => {
    if (!transport || !isHost) return;
    transport.send({ type: 'HOST_BAN', payload: { targetId: id } });
    setRoom((prev) => prev ? { ...prev, players: prev.players.filter((p) => p.id !== id), bannedIds: [...prev.bannedIds, id] } : prev);
  }, [transport, isHost]);

  const transferHost = useCallback((id: string) => {
    if (!transport || !isHost) return;
    transport.send({ type: 'HOST_TRANSFER', payload: { newHostId: id } });
    setRoom((prev) => {
      if (!prev) return prev;
      return { ...prev, hostId: id, players: prev.players.map((p) => {
        if (p.id === id) return { ...p, role: Role.HOST };
        if (p.id === prev.hostId) return { ...p, role: Role.PLAYER };
        return p;
      }) };
    });
  }, [transport, isHost]);

  const toggleReady = useCallback(() => {
    if (!transport || !currentPlayerId) return;
    setRoom((prev) => {
      if (!prev) return prev;
      const me = prev.players.find((p) => p.id === currentPlayerId);
      if (!me) return prev;
      const newReady = !me.ready;
      transport.send({ type: 'PLAYER_READY', payload: { playerId: currentPlayerId, ready: newReady } });
      return { ...prev, players: prev.players.map((p) => p.id === currentPlayerId ? { ...p, ready: newReady } : p) };
    });
  }, [transport, currentPlayerId]);

  useEffect(() => {
    if (!transport) return;
    const unsubscribe = transport.subscribe((message: GameMessage, senderId: string) => {
      switch (message.type) {
        case 'PLAYER_JOIN': {
          const joiningPlayer = message.payload.player;
          if (roomRef.current?.bannedIds.includes(joiningPlayer.id)) return;
          heartbeatsRef.current[joiningPlayer.id] = Date.now();
          setRoom((prev) => {
            if (!prev) return prev;
            if (prev.players.some((p) => p.id === joiningPlayer.id)) {
              return { ...prev, players: prev.players.map((p) => p.id === joiningPlayer.id ? { ...p, connected: true } : p) };
            }
            return { ...prev, players: [...prev.players, { ...joiningPlayer, connected: true }] };
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
              const sorted = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt);
              newHostId = sorted[0].id;
              updatedPlayers = remaining.map((p) => p.id === newHostId ? { ...p, role: Role.HOST } : p);
            }
            return { ...prev, hostId: newHostId, players: updatedPlayers };
          });
          break;
        }
        case 'PLAYER_READY': {
          const { playerId, ready } = message.payload;
          setRoom((prev) => prev ? { ...prev, players: prev.players.map((p) => p.id === playerId ? { ...p, ready } : p) } : prev);
          break;
        }
        case 'HOST_KICK': {
          const { targetId } = message.payload;
          if (targetId === currentPlayerIdRef.current) { setRoom(null); setCurrentPlayerId(null); heartbeatsRef.current = {}; return; }
          setRoom((prev) => prev ? { ...prev, players: prev.players.filter((p) => p.id !== targetId) } : prev);
          break;
        }
        case 'HOST_BAN': {
          const { targetId } = message.payload;
          if (targetId === currentPlayerIdRef.current) { setRoom(null); setCurrentPlayerId(null); heartbeatsRef.current = {}; return; }
          setRoom((prev) => prev ? { ...prev, players: prev.players.filter((p) => p.id !== targetId), bannedIds: [...prev.bannedIds, targetId] } : prev);
          break;
        }
        case 'HOST_TRANSFER': {
          const { newHostId } = message.payload;
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, hostId: newHostId, players: prev.players.map((p) => {
              if (p.id === newHostId) return { ...p, role: Role.HOST };
              if (p.id === prev.hostId) return { ...p, role: Role.PLAYER };
              return p;
            }) };
          });
          break;
        }
        case 'GAME_STATE_SYNC': {
          if (currentPlayerIdRef.current !== roomRef.current?.hostId) {
            const { players, hostId } = message.payload;
            if (players && players.length > 0) {
              setRoom((prev) => prev ? { ...prev, hostId: hostId || prev.hostId, players } : prev);
            }
          }
          break;
        }
        case 'HEARTBEAT': {
          heartbeatsRef.current[message.payload.playerId] = message.payload.timestamp;
          break;
        }
        default: break;
      }
    });
    return unsubscribe;
  }, [transport]);

  useEffect(() => {
    if (!transport || !currentPlayerId) return;
    const interval = setInterval(() => {
      transport.send({ type: 'HEARTBEAT', payload: { playerId: currentPlayerId, timestamp: Date.now() } });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [transport, currentPlayerId]);

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
        if (player.id === currentPlayerIdRef.current) continue;
        const lastHB = heartbeatsRef.current[player.id] ?? 0;
        if (now - lastHB > DISCONNECT_THRESHOLD_MS && player.connected) {
          updatedPlayers = updatedPlayers.map((p) => p.id === player.id ? { ...p, connected: false } : p);
          roomChanged = true;
          if (player.id === newHostId) {
            const connected = updatedPlayers.filter((p) => p.connected).sort((a, b) => a.joinedAt - b.joinedAt);
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
        setRoom((prev) => prev ? { ...prev, hostId: newHostId, players: updatedPlayers } : prev);
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [transport, room, isHost]);

  const value: RoomContextValue = { room, currentPlayerId, isHost, createRoom, joinRoom, leaveRoom, kickPlayer, banPlayer, transferHost, toggleReady };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used within a RoomProvider');
  return ctx;
}

export default RoomContext;
