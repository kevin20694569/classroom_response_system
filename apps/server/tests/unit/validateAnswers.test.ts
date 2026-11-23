import { describe, expect, it } from 'vitest';
import { validateAnswers } from '../../src/domain/submission/validateAnswers.js';
import { groupQuestion, singleQuestion } from '../helpers/builders.js';

describe('validateAnswers', () => {
  it('單題：去除前後空白後保存', () => {
    expect(validateAnswers(singleQuestion(1), [{ blankIndex: 1, text: '  CPU ' }])).toEqual([
      { blankIndex: 1, text: 'CPU' },
    ]);
  });

  it('題組：依子題序號排序', () => {
    const answers = validateAnswers(groupQuestion(1), [
      { blankIndex: 2, text: '作業系統' },
      { blankIndex: 1, text: 'CPU' },
    ]);
    expect(answers.map((a) => a.blankIndex)).toEqual([1, 2]);
  });

  it.each([
    ['缺子題', [{ blankIndex: 1, text: 'CPU' }]],
    [
      '重複子題',
      [
        { blankIndex: 1, text: 'a' },
        { blankIndex: 1, text: 'b' },
      ],
    ],
    [
      '不存在的子題',
      [
        { blankIndex: 1, text: 'a' },
        { blankIndex: 3, text: 'b' },
      ],
    ],
    ['沒有答案', []],
  ])('題組%s → ANSWER_INCOMPLETE', (_label, answers) => {
    expect(() => validateAnswers(groupQuestion(1), answers)).toThrow(
      expect.objectContaining({ code: 'ANSWER_INCOMPLETE' }),
    );
  });

  it('空白、只有空格、201 字 → ANSWER_INVALID 並指出子題', () => {
    try {
      validateAnswers(groupQuestion(1), [
        { blankIndex: 1, text: '   ' },
        { blankIndex: 2, text: '字'.repeat(201) },
      ]);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: 'ANSWER_INVALID' });
      expect(
        (error as { details: { blankIndex: number; code: string }[] }).details.map((d) => [
          d.blankIndex,
          d.code,
        ]),
      ).toEqual([
        [1, 'EMPTY_ANSWER'],
        [2, 'ANSWER_TOO_LONG'],
      ]);
    }
  });

  it('剛好 200 字可以送出', () => {
    expect(
      validateAnswers(singleQuestion(1), [{ blankIndex: 1, text: '字'.repeat(200) }]),
    ).toHaveLength(1);
  });
});
