export enum Role {
  HOST = 'host',
  PLAYER = 'player',
  SPECTATOR = 'spectator',
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  color: string;
  isBot: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  createdAt: number;
  maxPlayers: number;
  bannedIds: string[];
}

export const PLAYER_COLORS = [
  '#f5e642', // neon yellow
  '#ff2d78', // hot pink
  '#00e5ff', // cyan
  '#39ff14', // green
  '#bf40ff', // purple
  '#ff8c00', // orange
  '#ff4444', // red
  '#44ff88', // mint
  '#ff44ff', // magenta
  '#4488ff', // blue
];
