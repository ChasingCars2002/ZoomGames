export enum GameType {
  PICTIONARY = 'pictionary',
  WORD_ASSOCIATION = 'word_association',
  TRIVIA = 'trivia',
  TWO_TRUTHS = 'two_truths',
  WORD_SCRAMBLE = 'word_scramble',
  CHARADES = 'charades',
  HANGMAN = 'hangman',
  SCATTERGORIES = 'scattergories',
  EMOJI_DECODE = 'emoji_decode',
  BLUFF_TRIVIA = 'bluff_trivia',
  MIND_MELD = 'mind_meld',
}

export enum GamePhase {
  IDLE = 'idle',
  LOBBY = 'lobby',
  GAME_STARTING = 'game_starting',
  ROUND_STARTING = 'round_starting',
  ROUND_ACTIVE = 'round_active',
  ROUND_ENDING = 'round_ending',
  GAME_ENDING = 'game_ending',
  RESULTS = 'results',
}

export interface GameConfig {
  rounds: number;
  timeLimit: number; // seconds
  difficulty: 'easy' | 'medium' | 'hard';
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  rounds: 3,
  timeLimit: 60,
  difficulty: 'medium',
};

export interface GameMeta {
  type: GameType;
  name: string;
  emoji: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  defaultConfig: GameConfig;
}
