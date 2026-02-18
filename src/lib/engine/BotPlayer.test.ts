import { describe, it, expect } from 'vitest';
import { generateBotAction, BOT_NAMES } from './BotPlayer';
import { GameType } from '../../types';

describe('generateBotAction', () => {
  it('returns null for null roundData', () => {
    expect(generateBotAction(GameType.TRIVIA, null)).toBeNull();
  });

  it('generates a trivia answer action', () => {
    const action = generateBotAction(GameType.TRIVIA, { correctIndex: 2 });
    expect(action).not.toBeNull();
    expect(action!.type).toBe('answer');
    if (action!.type === 'answer') {
      expect(action!.answerIndex).toBeGreaterThanOrEqual(0);
      expect(action!.answerIndex).toBeLessThanOrEqual(3);
    }
  });

  it('generates a word scramble guess', () => {
    const action = generateBotAction(GameType.WORD_SCRAMBLE, { originalWord: 'hello' });
    expect(action).not.toBeNull();
    expect(action!.type).toBe('guess');
  });

  it('generates a pictionary guess', () => {
    const action = generateBotAction(GameType.PICTIONARY, { word: 'cat' });
    expect(action).not.toBeNull();
    expect(action!.type).toBe('guess');
  });

  it('generates a word association submit', () => {
    const action = generateBotAction(GameType.WORD_ASSOCIATION, { currentWord: 'fire' });
    expect(action).not.toBeNull();
    expect(action!.type).toBe('submit_word');
  });

  it('generates two truths statements during submitting phase', () => {
    const action = generateBotAction(GameType.TWO_TRUTHS, { phase: 'submitting' });
    expect(action).not.toBeNull();
    expect(action!.type).toBe('submit_statements');
  });

  it('generates two truths vote during voting phase', () => {
    const action = generateBotAction(GameType.TWO_TRUTHS, { phase: 'voting' });
    expect(action).not.toBeNull();
    expect(action!.type).toBe('vote');
  });

  it('generates a charades guess', () => {
    const action = generateBotAction(GameType.CHARADES, { word: 'swimming' });
    expect(action).not.toBeNull();
    expect(action!.type).toBe('guess');
  });
});

describe('BOT_NAMES', () => {
  it('has at least 5 bot names', () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(5);
  });

  it('contains only strings', () => {
    expect(BOT_NAMES.every((name) => typeof name === 'string')).toBe(true);
  });
});
