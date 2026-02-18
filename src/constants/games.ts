import { GameType, GameMeta } from '../types/game';

export const GAME_LIST: GameMeta[] = [
  {
    type: GameType.PICTIONARY,
    name: 'Pictionary',
    emoji: '\uD83C\uDFA8',
    description: 'Draw & Guess! One player draws while others guess the word.',
    minPlayers: 2,
    maxPlayers: 12,
    defaultConfig: { rounds: 3, timeLimit: 60, difficulty: 'medium' },
  },
  {
    type: GameType.WORD_ASSOCIATION,
    name: 'Word Association',
    emoji: '\uD83D\uDCAC',
    description: 'Chain words together! Say a word that connects to the previous one.',
    minPlayers: 2,
    maxPlayers: 12,
    defaultConfig: { rounds: 3, timeLimit: 10, difficulty: 'medium' },
  },
  {
    type: GameType.TRIVIA,
    name: 'Trivia Battle',
    emoji: '\uD83E\uDDE0',
    description: 'Test your knowledge! Answer questions faster for more points.',
    minPlayers: 1,
    maxPlayers: 20,
    defaultConfig: { rounds: 10, timeLimit: 15, difficulty: 'medium' },
  },
  {
    type: GameType.TWO_TRUTHS,
    name: 'Two Truths & A Lie',
    emoji: '\uD83E\uDD2B',
    description: 'Can you spot the lie? Submit truths and a lie, then vote!',
    minPlayers: 2,
    maxPlayers: 12,
    defaultConfig: { rounds: 1, timeLimit: 60, difficulty: 'medium' },
  },
  {
    type: GameType.WORD_SCRAMBLE,
    name: 'Word Scramble',
    emoji: '\uD83D\uDD24',
    description: 'Unscramble the letters! First to type the correct word wins.',
    minPlayers: 1,
    maxPlayers: 20,
    defaultConfig: { rounds: 10, timeLimit: 30, difficulty: 'medium' },
  },
  {
    type: GameType.CHARADES,
    name: 'Charades',
    emoji: '\uD83C\uDFAD',
    description: 'Act it out on camera! Others type their guesses.',
    minPlayers: 2,
    maxPlayers: 12,
    defaultConfig: { rounds: 3, timeLimit: 90, difficulty: 'medium' },
  },
];

export const GAME_MAP = Object.fromEntries(
  GAME_LIST.map((g) => [g.type, g])
) as Record<GameType, GameMeta>;
