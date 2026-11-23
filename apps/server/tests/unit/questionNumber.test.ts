import { describe, expect, it } from 'vitest';
import { parseQuestionNumber } from '../../src/domain/guidedNotes/questionNumber.js';

describe('parseQuestionNumber（FR-007a）', () => {
  it.each([
    ['1', 1],
    ['12', 12],
    [' 3 ', 3],
    ['1.', 1],
    ['2、', 2],
    ['Q1', 1],
    ['q7', 7],
    ['第1題', 1],
    ['１', 1],
    ['第１２題', 12],
  ])('「%s」→ %i', (raw, expected) => {
    expect(parseQuestionNumber(raw)).toBe(expected);
  });

  it.each(['', '   '])('空白「%s」→ empty', (raw) => {
    expect(parseQuestionNumber(raw)).toBe('empty');
  });

  it.each(['0', 'A-1', '一', '備註', '1-1', 'Q', '第題', '1..'])('「%s」→ invalid', (raw) => {
    expect(parseQuestionNumber(raw)).toBe('invalid');
  });
});
