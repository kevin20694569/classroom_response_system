import type { OwnSubmission, ResultView } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { groupOutcomes, wonCount } from '../src/student/groupOutcomes';

const a = (text: string) => [{ blankIndex: 1, text }];
const own = (
  questionNumber: number,
  grading: OwnSubmission['grading'],
  submitterNickname: string | null = null,
): OwnSubmission => ({
  questionNumber,
  answers: a(`本組第 ${questionNumber} 題`),
  submitterNickname,
  grading,
});

const result = (
  questionNumber: number,
  winnerGroupId: number | null,
  submitterNickname: string | null = null,
): ResultView => ({
  questionNumber,
  winnerGroupId,
  answers: winnerGroupId === null ? null : a(`第 ${winnerGroupId} 組的答案`),
  submitterNickname,
});

describe('groupOutcomes — 批改完成前（004 FR-033）', () => {
  const outcomes = groupOutcomes([3, 1, 2], null, [own(1, 'PENDING'), own(2, 'CORRECT')], 2);

  it('依題號排序，包含本組沒有送出的題目', () => {
    expect(outcomes.map((o) => o.questionNumber)).toEqual([1, 2, 3]);
  });

  it('未勾選為等待批改、已勾選為答對、沒有送出為本組未作答；看不到搶答成功組別', () => {
    expect(outcomes.map((o) => o.kind)).toEqual(['PENDING', 'CORRECT', 'NOT_SUBMITTED']);
    expect(outcomes.every((o) => o.winnerGroupId === null && o.winnerAnswers === null)).toBe(true);
    expect(outcomes[0]?.ownAnswers).toEqual(a('本組第 1 題'));
    expect(wonCount(outcomes)).toBe(0);
  });
});

describe('groupOutcomes — 批改完成後（004 FR-034）', () => {
  const outcomes = groupOutcomes(
    [1, 2, 3, 4],
    [result(1, 2, 'Milo'), result(2, 1, 'Ava'), result(3, 1, 'Ava'), result(4, null)],
    [own(1, 'CORRECT', 'Milo'), own(2, 'CORRECT', 'Leo'), own(3, 'INCORRECT', 'Leo')],
    2,
  );

  it('答對中最早為本組搶答成功、其他答對為回答成功、未勾選為答錯、沒有送出為本組未作答', () => {
    expect(outcomes.map((o) => o.kind)).toEqual([
      'WON',
      'ANSWERED_CORRECT',
      'INCORRECT',
      'NOT_SUBMITTED',
    ]);
  });

  it('帶出搶答成功答案、送出者與本組送出者；無人答對時搶答成功欄位為 null', () => {
    expect(outcomes[1]).toMatchObject({
      winnerGroupId: 1,
      winnerAnswers: a('第 1 組的答案'),
      winnerSubmitter: 'Ava',
      ownSubmitter: 'Leo',
    });
    expect(outcomes[3]).toMatchObject({ winnerGroupId: null, winnerAnswers: null });
  });

  it('搶答成功題數只算本組搶答成功', () => {
    expect(wonCount(outcomes)).toBe(1);
    expect(wonCount([])).toBe(0);
  });
});
