import type { OwnSubmission, ResultView } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { groupOutcomes, wonCount } from '../src/student/groupOutcomes';

const a = (text: string) => [{ blankIndex: 1, text }];
const results: ResultView[] = [
  { questionNumber: 3, winnerGroupId: 1, answers: a('第一組的答案') },
  { questionNumber: 1, winnerGroupId: 2, answers: a('本組的答案一') },
  { questionNumber: 2, winnerGroupId: null, answers: null },
  { questionNumber: 4, winnerGroupId: 3, answers: a('第三組的答案') },
];
const own: OwnSubmission[] = [
  { questionNumber: 1, answers: a('本組的答案一') },
  { questionNumber: 3, answers: a('本組的答案三') },
];

describe('groupOutcomes（003 FR-024、FR-025、research R11）', () => {
  const outcomes = groupOutcomes(results, own, 2);

  it('依題號排序', () => {
    expect(outcomes.map((o) => o.questionNumber)).toEqual([1, 2, 3, 4]);
  });

  it('本組搶答成功為 WON', () => {
    expect(outcomes[0]).toEqual({
      questionNumber: 1,
      kind: 'WON',
      ownAnswers: a('本組的答案一'),
      winnerGroupId: 2,
      winnerAnswers: a('本組的答案一'),
    });
  });

  it('本組有送出但他組搶到為 SUBMITTED_NOT_WON，帶兩邊的答案', () => {
    expect(outcomes[2]).toEqual({
      questionNumber: 3,
      kind: 'SUBMITTED_NOT_WON',
      ownAnswers: a('本組的答案三'),
      winnerGroupId: 1,
      winnerAnswers: a('第一組的答案'),
    });
  });

  it('本組沒送出為 NOT_SUBMITTED；無人搶答時搶答成功欄位為 null', () => {
    expect(outcomes[1]).toEqual({
      questionNumber: 2,
      kind: 'NOT_SUBMITTED',
      ownAnswers: null,
      winnerGroupId: null,
      winnerAnswers: null,
    });
    expect(outcomes[3]?.kind).toBe('NOT_SUBMITTED');
  });

  it('搶答成功題數', () => {
    expect(wonCount(outcomes)).toBe(1);
    expect(wonCount(groupOutcomes(results, [], 2))).toBe(1);
    expect(wonCount(groupOutcomes(results, [], 5))).toBe(0);
    expect(wonCount([])).toBe(0);
  });
});
