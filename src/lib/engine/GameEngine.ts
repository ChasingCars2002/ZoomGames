import { GamePhase, GameConfig, GameType, Player, Role, PlayerAction } from '../../types';
import { DEFAULT_GAME_CONFIG } from '../../types';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface EngineState {
  phase: GamePhase;
  gameType: GameType | null;
  config: GameConfig;
  players: Player[];
  scores: Record<string, number>;
  currentRound: number;
  totalRounds: number;
  roundData: unknown;
  hostId: string;
  roomCode: string;
  timeRemaining: number;
  selectedGame: GameType | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type EngineAction =
  | { type: 'JOIN'; player: Player }
  | { type: 'LEAVE'; playerId: string }
  | { type: 'SET_READY'; playerId: string; ready: boolean }
  | { type: 'SELECT_GAME'; gameType: GameType }
  | { type: 'UPDATE_CONFIG'; config: Partial<GameConfig> }
  | { type: 'START_GAME' }
  | { type: 'START_ROUND'; roundData: unknown }
  | { type: 'PLAYER_ACTION'; playerId: string; action: PlayerAction }
  | { type: 'TICK' }
  | { type: 'END_ROUND'; scores: Record<string, number>; roundData?: unknown }
  | { type: 'END_GAME' }
  | { type: 'RESET' }
  | { type: 'KICK_PLAYER'; playerId: string }
  | { type: 'TRANSFER_HOST'; newHostId: string };

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createInitialState(roomCode: string, hostId: string): EngineState {
  return {
    phase: GamePhase.LOBBY,
    gameType: null,
    config: { ...DEFAULT_GAME_CONFIG },
    players: [],
    scores: {},
    currentRound: 0,
    totalRounds: DEFAULT_GAME_CONFIG.rounds,
    roundData: null,
    hostId,
    roomCode,
    timeRemaining: 0,
    selectedGame: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function updatePlayer(
  players: Player[],
  playerId: string,
  updater: (p: Player) => Player,
): Player[] {
  return players.map((p) => (p.id === playerId ? updater(p) : p));
}

function mergeScores(
  existing: Record<string, number>,
  roundScores: Record<string, number>,
): Record<string, number> {
  const merged = { ...existing };
  for (const [id, pts] of Object.entries(roundScores)) {
    merged[id] = (merged[id] ?? 0) + pts;
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    // ----- JOIN -----
    case 'JOIN': {
      // Prevent duplicate joins
      if (state.players.some((p) => p.id === action.player.id)) {
        // Re-mark the player as connected instead of adding a duplicate
        return {
          ...state,
          players: updatePlayer(state.players, action.player.id, (p) => ({
            ...p,
            connected: true,
          })),
        };
      }

      const newPlayer: Player = {
        ...action.player,
        role: action.player.id === state.hostId ? Role.HOST : Role.PLAYER,
        connected: true,
      };

      const updatedPlayers = [...state.players, newPlayer];
      const updatedScores = { ...state.scores, [newPlayer.id]: 0 };

      return {
        ...state,
        players: updatedPlayers,
        scores: updatedScores,
      };
    }

    // ----- LEAVE -----
    case 'LEAVE': {
      const leavingPlayer = state.players.find((p) => p.id === action.playerId);
      if (!leavingPlayer) return state;

      const remainingPlayers = state.players.filter((p) => p.id !== action.playerId);
      const { [action.playerId]: _removed, ...remainingScores } = state.scores;

      // If the host leaves and there are still players, transfer host
      let newHostId = state.hostId;
      let playersAfterHost = remainingPlayers;
      if (action.playerId === state.hostId && remainingPlayers.length > 0) {
        newHostId = remainingPlayers[0].id;
        playersAfterHost = updatePlayer(remainingPlayers, newHostId, (p) => ({
          ...p,
          role: Role.HOST,
        }));
      }

      // If no players remain, reset to lobby
      if (remainingPlayers.length === 0) {
        return createInitialState(state.roomCode, state.hostId);
      }

      return {
        ...state,
        players: playersAfterHost,
        scores: remainingScores,
        hostId: newHostId,
      };
    }

    // ----- SET_READY -----
    case 'SET_READY': {
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (p) => ({
          ...p,
          ready: action.ready,
        })),
      };
    }

    // ----- SELECT_GAME -----
    case 'SELECT_GAME': {
      if (state.phase !== GamePhase.LOBBY) return state;

      return {
        ...state,
        selectedGame: action.gameType,
      };
    }

    // ----- UPDATE_CONFIG -----
    case 'UPDATE_CONFIG': {
      if (state.phase !== GamePhase.LOBBY) return state;

      const newConfig: GameConfig = { ...state.config, ...action.config };
      return {
        ...state,
        config: newConfig,
        totalRounds: newConfig.rounds,
      };
    }

    // ----- START_GAME -----
    case 'START_GAME': {
      if (state.phase !== GamePhase.LOBBY) return state;
      if (!state.selectedGame) return state;

      // Reset scores for all current players
      const freshScores: Record<string, number> = {};
      for (const p of state.players) {
        freshScores[p.id] = 0;
      }

      return {
        ...state,
        phase: GamePhase.GAME_STARTING,
        gameType: state.selectedGame,
        scores: freshScores,
        currentRound: 0,
        totalRounds: state.config.rounds,
        roundData: null,
        timeRemaining: 0,
        // Reset all players' ready state
        players: state.players.map((p) => ({ ...p, ready: false })),
      };
    }

    // ----- START_ROUND -----
    case 'START_ROUND': {
      if (
        state.phase !== GamePhase.GAME_STARTING &&
        state.phase !== GamePhase.ROUND_ENDING
      ) {
        return state;
      }

      const nextRound = state.currentRound + 1;
      if (nextRound > state.totalRounds) return state;

      return {
        ...state,
        phase: GamePhase.ROUND_ACTIVE,
        currentRound: nextRound,
        roundData: action.roundData,
        timeRemaining: state.config.timeLimit,
      };
    }

    // ----- PLAYER_ACTION -----
    case 'PLAYER_ACTION': {
      if (state.phase !== GamePhase.ROUND_ACTIVE) return state;

      // Store the action in roundData so game-specific logic can process it.
      // We append to an actions array within roundData.
      const existingRoundData =
        state.roundData && typeof state.roundData === 'object'
          ? (state.roundData as Record<string, unknown>)
          : {};

      const existingActions = Array.isArray(existingRoundData.actions)
        ? (existingRoundData.actions as unknown[])
        : [];

      return {
        ...state,
        roundData: {
          ...existingRoundData,
          actions: [
            ...existingActions,
            {
              playerId: action.playerId,
              action: action.action,
              timestamp: Date.now(),
            },
          ],
        },
      };
    }

    // ----- TICK -----
    case 'TICK': {
      if (state.phase !== GamePhase.ROUND_ACTIVE) return state;

      const nextTime = state.timeRemaining - 1;

      if (nextTime <= 0) {
        return {
          ...state,
          timeRemaining: 0,
          phase: GamePhase.ROUND_ENDING,
        };
      }

      return {
        ...state,
        timeRemaining: nextTime,
      };
    }

    // ----- END_ROUND -----
    case 'END_ROUND': {
      if (
        state.phase !== GamePhase.ROUND_ACTIVE &&
        state.phase !== GamePhase.ROUND_ENDING
      ) {
        return state;
      }

      const updatedScores = mergeScores(state.scores, action.scores);

      // Determine next phase: if this was the last round, move to game ending
      const isLastRound = state.currentRound >= state.totalRounds;

      return {
        ...state,
        phase: isLastRound ? GamePhase.GAME_ENDING : GamePhase.ROUND_ENDING,
        scores: updatedScores,
        roundData: action.roundData !== undefined ? action.roundData : state.roundData,
        timeRemaining: 0,
      };
    }

    // ----- END_GAME -----
    case 'END_GAME': {
      return {
        ...state,
        phase: GamePhase.RESULTS,
        timeRemaining: 0,
      };
    }

    // ----- RESET -----
    case 'RESET': {
      // Return to lobby, keeping players and host but resetting game state
      return {
        ...state,
        phase: GamePhase.LOBBY,
        gameType: null,
        selectedGame: null,
        config: { ...DEFAULT_GAME_CONFIG },
        scores: Object.fromEntries(state.players.map((p) => [p.id, 0])),
        currentRound: 0,
        totalRounds: DEFAULT_GAME_CONFIG.rounds,
        roundData: null,
        timeRemaining: 0,
        players: state.players.map((p) => ({ ...p, ready: false })),
      };
    }

    // ----- KICK_PLAYER -----
    case 'KICK_PLAYER': {
      const kickedPlayer = state.players.find((p) => p.id === action.playerId);
      if (!kickedPlayer) return state;

      // Cannot kick the host
      if (action.playerId === state.hostId) return state;

      const playersAfterKick = state.players.filter((p) => p.id !== action.playerId);
      const { [action.playerId]: _kickedScore, ...scoresAfterKick } = state.scores;

      return {
        ...state,
        players: playersAfterKick,
        scores: scoresAfterKick,
      };
    }

    // ----- TRANSFER_HOST -----
    case 'TRANSFER_HOST': {
      const newHost = state.players.find((p) => p.id === action.newHostId);
      if (!newHost) return state;

      return {
        ...state,
        hostId: action.newHostId,
        players: state.players.map((p) => {
          if (p.id === action.newHostId) return { ...p, role: Role.HOST };
          if (p.id === state.hostId) return { ...p, role: Role.PLAYER };
          return p;
        }),
      };
    }

    default:
      return state;
  }
}
