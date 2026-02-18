import { GameType, PlayerAction } from '../../types';
import { pickRandom } from '../utils/shuffle';

const BOT_GUESSES_PICTIONARY = [
  'cat', 'dog', 'house', 'tree', 'sun', 'car', 'fish', 'bird', 'flower', 'boat',
  'mountain', 'star', 'moon', 'heart', 'cloud', 'apple', 'book', 'chair', 'door',
  'hat', 'shoe', 'ball', 'cake', 'bridge', 'clock', 'guitar', 'rocket', 'train',
  'umbrella', 'snowman', 'robot', 'pizza', 'phone', 'camera', 'balloon', 'dragon',
];

const BOT_ASSOCIATION_WORDS = [
  'blue', 'water', 'fire', 'sky', 'earth', 'sun', 'moon', 'star', 'night', 'day',
  'love', 'heart', 'gold', 'silver', 'green', 'red', 'cold', 'hot', 'fast', 'big',
  'happy', 'fun', 'music', 'dance', 'food', 'sweet', 'light', 'dark', 'rain', 'wind',
  'power', 'magic', 'dream', 'king', 'queen', 'hero', 'brave', 'wild', 'free', 'cool',
];

const BOT_CHARADES_GUESSES = [
  'dancing', 'swimming', 'cooking', 'singing', 'running', 'flying', 'eating',
  'sleeping', 'jumping', 'surfing', 'lion', 'monkey', 'elephant', 'penguin',
  'spider-man', 'batman', 'harry potter', 'star wars', 'nike', 'apple', 'disney',
  'mcdonalds', 'guitar', 'tennis', 'yoga', 'skateboarding',
];

export function generateBotAction(
  gameType: GameType,
  roundData: unknown,
): PlayerAction | null {
  const rd = roundData as Record<string, unknown> | null;
  if (!rd) return null;

  switch (gameType) {
    case GameType.TRIVIA: {
      // Pick a random answer index (0-3), with 60% chance of correct
      const correctIndex = (rd.correctIndex as number) ?? 0;
      const isCorrect = Math.random() < 0.6;
      const answerIndex = isCorrect
        ? correctIndex
        : [0, 1, 2, 3].filter((i) => i !== correctIndex)[Math.floor(Math.random() * 3)];
      return { type: 'answer', answerIndex, timestamp: Date.now() };
    }

    case GameType.WORD_SCRAMBLE: {
      // Sometimes guess correctly, sometimes guess randomly
      const original = rd.originalWord as string | undefined;
      if (original && Math.random() < 0.4) {
        return { type: 'guess', guess: original };
      }
      // Random wrong guess
      return { type: 'guess', guess: pickRandom(BOT_GUESSES_PICTIONARY) };
    }

    case GameType.PICTIONARY: {
      // Guess from the word pool
      const word = rd.word as string | undefined;
      if (word && Math.random() < 0.25) {
        return { type: 'guess', guess: word };
      }
      return { type: 'guess', guess: pickRandom(BOT_GUESSES_PICTIONARY) };
    }

    case GameType.WORD_ASSOCIATION: {
      return { type: 'submit_word', word: pickRandom(BOT_ASSOCIATION_WORDS) };
    }

    case GameType.TWO_TRUTHS: {
      const phase = rd.phase as string | undefined;
      if (phase === 'submitting') {
        return {
          type: 'submit_statements',
          statements: [
            'I once met a celebrity at a grocery store',
            'I can solve a Rubik\'s cube in under a minute',
            'I have visited every continent',
          ],
          lieIndex: 2,
        };
      }
      if (phase === 'voting') {
        return { type: 'vote', voteIndex: Math.floor(Math.random() * 3) };
      }
      return null;
    }

    case GameType.CHARADES: {
      return { type: 'guess', guess: pickRandom(BOT_CHARADES_GUESSES) };
    }

    default:
      return null;
  }
}

export const BOT_NAMES = [
  'RoboPlayer', 'BotBuddy', 'AI_Gamer', 'CyberPal', 'PixelBot',
  'NeonDroid', 'GameBot_3000', 'AutoPlay', 'ByteBuddy', 'CircuitPal',
];
