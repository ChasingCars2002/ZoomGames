import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  engineReducer,
  EngineState,
} from './GameEngine';
import { GamePhase, GameType, DEFAULT_GAME_CONFIG, Role, Player } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(id: string, name: string, overrides?: Partial<Player>): Player {
  return {
    id,
    name,
    role: Role.PLAYER,
    ready: false,
    connected: true,
    joinedAt: Date.now(),
    color: '#ff0000',
    isBot: false,
    ...overrides,
  };
}

function lobbyWithPlayers(): EngineState {
  let state = createInitialState('ABC123', 'host-1');
  state = engineReducer(state, { type: 'JOIN', player: makePlayer('host-1', 'Host') });
  state = engineReducer(state, { type: 'JOIN', player: makePlayer('p2', 'Alice') });
  state = engineReducer(state, { type: 'SELECT_GAME', gameType: GameType.TRIVIA });
  return state;
}

function activeGameState(): EngineState {
  let state = lobbyWithPlayers();
  state = engineReducer(state, { type: 'START_GAME' });
  state = engineReducer(state, {
    type: 'START_ROUND',
    roundData: { question: 'What color is the sky?', correctIndex: 1 },
  });
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
  it('returns a state in LOBBY phase', () => {
    const state = createInitialState('ABC123', 'host-1');
    expect(state.phase).toBe(GamePhase.LOBBY);
    expect(state.roomCode).toBe('ABC123');
    expect(state.hostId).toBe('host-1');
    expect(state.players).toHaveLength(0);
    expect(state.scores).toEqual({});
    expect(state.currentRound).toBe(0);
    expect(state.gameType).toBeNull();
    expect(state.selectedGame).toBeNull();
  });

  it('uses default game config', () => {
    const state = createInitialState('XYZ789', 'h1');
    expect(state.config).toEqual(DEFAULT_GAME_CONFIG);
    expect(state.totalRounds).toBe(DEFAULT_GAME_CONFIG.rounds);
  });
});

describe('engineReducer – JOIN', () => {
  it('adds a new player with initial score of 0', () => {
    const state = createInitialState('ABC123', 'host-1');
    const player = makePlayer('host-1', 'Host');
    const next = engineReducer(state, { type: 'JOIN', player });

    expect(next.players).toHaveLength(1);
    expect(next.players[0].id).toBe('host-1');
    expect(next.players[0].role).toBe(Role.HOST);
    expect(next.scores['host-1']).toBe(0);
  });

  it('assigns HOST role to the player whose id matches hostId', () => {
    let state = createInitialState('ABC123', 'host-1');
    state = engineReducer(state, { type: 'JOIN', player: makePlayer('host-1', 'Host') });
    state = engineReducer(state, { type: 'JOIN', player: makePlayer('p2', 'Alice') });

    expect(state.players[0].role).toBe(Role.HOST);
    expect(state.players[1].role).toBe(Role.PLAYER);
  });

  it('prevents duplicate joins and re-marks as connected', () => {
    let state = createInitialState('ABC123', 'host-1');
    state = engineReducer(state, { type: 'JOIN', player: makePlayer('host-1', 'Host') });
    // Simulate reconnect
    state = engineReducer(state, {
      type: 'JOIN',
      player: makePlayer('host-1', 'Host', { connected: false }),
    });

    expect(state.players).toHaveLength(1);
    expect(state.players[0].connected).toBe(true);
  });
});

describe('engineReducer – LEAVE', () => {
  it('removes a player and their score', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'LEAVE', playerId: 'p2' });

    expect(state.players).toHaveLength(1);
    expect(state.scores).not.toHaveProperty('p2');
  });

  it('transfers host when host leaves', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'LEAVE', playerId: 'host-1' });

    expect(state.hostId).toBe('p2');
    expect(state.players[0].role).toBe(Role.HOST);
  });

  it('resets to initial state when last player leaves', () => {
    let state = createInitialState('ABC123', 'host-1');
    state = engineReducer(state, { type: 'JOIN', player: makePlayer('host-1', 'Host') });
    state = engineReducer(state, { type: 'LEAVE', playerId: 'host-1' });

    expect(state.players).toHaveLength(0);
    expect(state.phase).toBe(GamePhase.LOBBY);
  });

  it('ignores leave for unknown player', () => {
    const state = lobbyWithPlayers();
    const next = engineReducer(state, { type: 'LEAVE', playerId: 'unknown' });
    expect(next).toBe(state);
  });
});

describe('engineReducer – SET_READY', () => {
  it('toggles player ready state', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'SET_READY', playerId: 'p2', ready: true });

    const player = state.players.find((p) => p.id === 'p2');
    expect(player?.ready).toBe(true);
  });
});

describe('engineReducer – SELECT_GAME', () => {
  it('selects a game in LOBBY phase', () => {
    let state = createInitialState('ABC123', 'host-1');
    state = engineReducer(state, { type: 'SELECT_GAME', gameType: GameType.PICTIONARY });
    expect(state.selectedGame).toBe(GameType.PICTIONARY);
  });

  it('ignores game selection outside LOBBY phase', () => {
    const state = activeGameState();
    const next = engineReducer(state, { type: 'SELECT_GAME', gameType: GameType.CHARADES });
    expect(next.selectedGame).toBe(GameType.TRIVIA);
  });
});

describe('engineReducer – UPDATE_CONFIG', () => {
  it('updates config in LOBBY phase', () => {
    let state = createInitialState('ABC123', 'host-1');
    state = engineReducer(state, { type: 'UPDATE_CONFIG', config: { rounds: 5, timeLimit: 90 } });

    expect(state.config.rounds).toBe(5);
    expect(state.config.timeLimit).toBe(90);
    expect(state.totalRounds).toBe(5);
  });

  it('ignores config updates outside LOBBY phase', () => {
    const state = activeGameState();
    const next = engineReducer(state, { type: 'UPDATE_CONFIG', config: { rounds: 10 } });
    expect(next.config.rounds).toBe(DEFAULT_GAME_CONFIG.rounds);
  });
});

describe('engineReducer – START_GAME', () => {
  it('transitions to GAME_STARTING with selected game', () => {
    const state = lobbyWithPlayers();
    const next = engineReducer(state, { type: 'START_GAME' });

    expect(next.phase).toBe(GamePhase.GAME_STARTING);
    expect(next.gameType).toBe(GameType.TRIVIA);
    expect(next.currentRound).toBe(0);
    expect(next.scores['host-1']).toBe(0);
    expect(next.scores['p2']).toBe(0);
  });

  it('resets all players ready state', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'SET_READY', playerId: 'p2', ready: true });
    const next = engineReducer(state, { type: 'START_GAME' });

    expect(next.players.every((p) => !p.ready)).toBe(true);
  });

  it('does nothing without a selected game', () => {
    let state = createInitialState('ABC123', 'host-1');
    state = engineReducer(state, { type: 'JOIN', player: makePlayer('host-1', 'Host') });
    const next = engineReducer(state, { type: 'START_GAME' });

    expect(next.phase).toBe(GamePhase.LOBBY);
  });

  it('does nothing outside LOBBY phase', () => {
    const state = activeGameState();
    const next = engineReducer(state, { type: 'START_GAME' });
    expect(next.phase).toBe(GamePhase.ROUND_ACTIVE);
  });
});

describe('engineReducer – START_ROUND', () => {
  it('starts a new round from GAME_STARTING', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'START_GAME' });
    const next = engineReducer(state, {
      type: 'START_ROUND',
      roundData: { question: 'Test?' },
    });

    expect(next.phase).toBe(GamePhase.ROUND_ACTIVE);
    expect(next.currentRound).toBe(1);
    expect(next.roundData).toEqual({ question: 'Test?' });
    expect(next.timeRemaining).toBe(DEFAULT_GAME_CONFIG.timeLimit);
  });

  it('starts a new round from ROUND_ENDING', () => {
    let state = activeGameState();
    state = engineReducer(state, { type: 'END_ROUND', scores: {} });
    const next = engineReducer(state, {
      type: 'START_ROUND',
      roundData: { question: 'Round 2?' },
    });

    expect(next.phase).toBe(GamePhase.ROUND_ACTIVE);
    expect(next.currentRound).toBe(2);
  });

  it('does not exceed totalRounds', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'UPDATE_CONFIG', config: { rounds: 1 } });
    state = engineReducer(state, { type: 'START_GAME' });
    state = engineReducer(state, { type: 'START_ROUND', roundData: {} });
    state = engineReducer(state, { type: 'END_ROUND', scores: {} });
    // Round 2 should not start with only 1 round configured
    // But END_ROUND moved us to GAME_ENDING because currentRound >= totalRounds
    expect(state.phase).toBe(GamePhase.GAME_ENDING);
  });
});

describe('engineReducer – PLAYER_ACTION', () => {
  it('appends action to roundData during ROUND_ACTIVE', () => {
    const state = activeGameState();
    const next = engineReducer(state, {
      type: 'PLAYER_ACTION',
      playerId: 'p2',
      action: { type: 'answer', answerIndex: 1, timestamp: Date.now() },
    });

    const rd = next.roundData as Record<string, unknown>;
    const actions = rd.actions as Array<{ playerId: string }>;
    expect(actions).toHaveLength(1);
    expect(actions[0].playerId).toBe('p2');
  });

  it('ignores actions outside ROUND_ACTIVE', () => {
    const state = lobbyWithPlayers();
    const next = engineReducer(state, {
      type: 'PLAYER_ACTION',
      playerId: 'p2',
      action: { type: 'guess', guess: 'test' },
    });
    expect(next).toBe(state);
  });
});

describe('engineReducer – TICK', () => {
  it('decrements timeRemaining by 1', () => {
    const state = activeGameState();
    const next = engineReducer(state, { type: 'TICK' });
    expect(next.timeRemaining).toBe(state.timeRemaining - 1);
  });

  it('transitions to ROUND_ENDING when time hits 0', () => {
    let state = activeGameState();
    // Set time to 1 so next tick ends the round
    state = { ...state, timeRemaining: 1 };
    const next = engineReducer(state, { type: 'TICK' });
    expect(next.timeRemaining).toBe(0);
    expect(next.phase).toBe(GamePhase.ROUND_ENDING);
  });

  it('ignores ticks outside ROUND_ACTIVE', () => {
    const state = lobbyWithPlayers();
    const next = engineReducer(state, { type: 'TICK' });
    expect(next).toBe(state);
  });
});

describe('engineReducer – END_ROUND', () => {
  it('merges round scores into cumulative scores', () => {
    const state = activeGameState();
    const next = engineReducer(state, {
      type: 'END_ROUND',
      scores: { 'host-1': 500, p2: 300 },
    });

    expect(next.scores['host-1']).toBe(500);
    expect(next.scores['p2']).toBe(300);
  });

  it('transitions to ROUND_ENDING when more rounds remain', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'UPDATE_CONFIG', config: { rounds: 3 } });
    state = engineReducer(state, { type: 'START_GAME' });
    state = engineReducer(state, { type: 'START_ROUND', roundData: {} });
    state = engineReducer(state, { type: 'END_ROUND', scores: {} });

    expect(state.phase).toBe(GamePhase.ROUND_ENDING);
  });

  it('transitions to GAME_ENDING when on last round', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'UPDATE_CONFIG', config: { rounds: 1 } });
    state = engineReducer(state, { type: 'START_GAME' });
    state = engineReducer(state, { type: 'START_ROUND', roundData: {} });
    state = engineReducer(state, { type: 'END_ROUND', scores: {} });

    expect(state.phase).toBe(GamePhase.GAME_ENDING);
  });

  it('accumulates scores across multiple rounds', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'UPDATE_CONFIG', config: { rounds: 2 } });
    state = engineReducer(state, { type: 'START_GAME' });

    // Round 1
    state = engineReducer(state, { type: 'START_ROUND', roundData: {} });
    state = engineReducer(state, { type: 'END_ROUND', scores: { 'host-1': 100, p2: 200 } });

    // Round 2
    state = engineReducer(state, { type: 'START_ROUND', roundData: {} });
    state = engineReducer(state, { type: 'END_ROUND', scores: { 'host-1': 300, p2: 100 } });

    expect(state.scores['host-1']).toBe(400);
    expect(state.scores['p2']).toBe(300);
  });
});

describe('engineReducer – END_GAME', () => {
  it('transitions to RESULTS phase', () => {
    let state = activeGameState();
    state = engineReducer(state, { type: 'END_ROUND', scores: {} });
    state = engineReducer(state, { type: 'END_GAME' });

    expect(state.phase).toBe(GamePhase.RESULTS);
    expect(state.timeRemaining).toBe(0);
  });
});

describe('engineReducer – RESET', () => {
  it('returns to LOBBY with players intact and scores zeroed', () => {
    let state = activeGameState();
    state = engineReducer(state, {
      type: 'END_ROUND',
      scores: { 'host-1': 500, p2: 300 },
    });
    state = engineReducer(state, { type: 'RESET' });

    expect(state.phase).toBe(GamePhase.LOBBY);
    expect(state.gameType).toBeNull();
    expect(state.selectedGame).toBeNull();
    expect(state.currentRound).toBe(0);
    expect(state.players).toHaveLength(2);
    expect(state.scores['host-1']).toBe(0);
    expect(state.scores['p2']).toBe(0);
    expect(state.players.every((p) => !p.ready)).toBe(true);
  });
});

describe('engineReducer – KICK_PLAYER', () => {
  it('removes the kicked player', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'KICK_PLAYER', playerId: 'p2' });

    expect(state.players).toHaveLength(1);
    expect(state.scores).not.toHaveProperty('p2');
  });

  it('cannot kick the host', () => {
    const state = lobbyWithPlayers();
    const next = engineReducer(state, { type: 'KICK_PLAYER', playerId: 'host-1' });
    expect(next.players).toHaveLength(2);
  });

  it('ignores kick for unknown player', () => {
    const state = lobbyWithPlayers();
    const next = engineReducer(state, { type: 'KICK_PLAYER', playerId: 'unknown' });
    expect(next).toBe(state);
  });
});

describe('engineReducer – TRANSFER_HOST', () => {
  it('transfers host role to another player', () => {
    let state = lobbyWithPlayers();
    state = engineReducer(state, { type: 'TRANSFER_HOST', newHostId: 'p2' });

    expect(state.hostId).toBe('p2');
    const newHost = state.players.find((p) => p.id === 'p2');
    const oldHost = state.players.find((p) => p.id === 'host-1');
    expect(newHost?.role).toBe(Role.HOST);
    expect(oldHost?.role).toBe(Role.PLAYER);
  });

  it('ignores transfer to unknown player', () => {
    const state = lobbyWithPlayers();
    const next = engineReducer(state, { type: 'TRANSFER_HOST', newHostId: 'unknown' });
    expect(next.hostId).toBe('host-1');
  });
});
