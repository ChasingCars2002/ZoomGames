import { Player } from './room';
import { GameType, GameConfig, GamePhase } from './game';

export interface StrokeData {
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

export type PlayerAction =
  | { type: 'guess'; guess: string }
  | { type: 'answer'; answerIndex: number; timestamp: number }
  | { type: 'submit_word'; word: string }
  | { type: 'submit_statements'; statements: string[]; lieIndex: number }
  | { type: 'vote'; voteIndex: number }
  | { type: 'pass' }
  | { type: 'confirm_guess'; playerId: string }
  | { type: 'use_hint' }
  | { type: 'challenge'; targetId: string };

export type GameMessage =
  | { type: 'PLAYER_JOIN'; payload: { player: Player } }
  | { type: 'PLAYER_LEAVE'; payload: { playerId: string } }
  | { type: 'PLAYER_READY'; payload: { playerId: string; ready: boolean } }
  | { type: 'GAME_SELECT'; payload: { gameType: GameType } }
  | { type: 'GAME_CONFIG'; payload: { config: GameConfig } }
  | { type: 'GAME_START'; payload: { gameType: GameType; config: GameConfig } }
  | {
      type: 'GAME_STATE_SYNC';
      payload: {
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
      };
    }
  | { type: 'ROUND_START'; payload: { round: number; data: unknown } }
  | { type: 'ROUND_END'; payload: { scores: Record<string, number>; roundData: unknown } }
  | { type: 'PLAYER_ACTION'; payload: { playerId: string; action: PlayerAction } }
  | { type: 'DRAW_STROKE'; payload: { stroke: StrokeData } }
  | { type: 'DRAW_CLEAR'; payload: Record<string, never> }
  | { type: 'DRAW_UNDO'; payload: Record<string, never> }
  | { type: 'CHAT_MESSAGE'; payload: { playerId: string; text: string; timestamp: number } }
  | { type: 'HOST_KICK'; payload: { targetId: string } }
  | { type: 'HOST_BAN'; payload: { targetId: string } }
  | { type: 'HOST_TRANSFER'; payload: { newHostId: string } }
  | { type: 'GAME_END'; payload: { finalScores: Record<string, number> } }
  | { type: 'RETURN_TO_LOBBY'; payload: Record<string, never> }
  | { type: 'HEARTBEAT'; payload: { playerId: string; timestamp: number } }
  | { type: 'REQUEST_SYNC'; payload: { playerId: string } };

export interface TransportMessage {
  senderId: string;
  timestamp: number;
  message: GameMessage;
}
