import type { BlankAnswer, GroupId, OwnSubmission, ResultView } from '@crs/shared';

/**
 * 本組在某題的成績（003 FR-025；004 FR-033、FR-034 改為依老師批改）：
 * - 批改完成前：PENDING 等待老師批改、CORRECT 老師已勾選答對、NOT_SUBMITTED 本組未作答。
 * - 批改完成後：WON 本組搶答成功（答對中最早送出）、ANSWERED_CORRECT 回答成功（答對但不是最早）、
 *   INCORRECT 答錯（未勾選）、NOT_SUBMITTED 本組未作答。
 */
export type OutcomeKind =
  'PENDING' | 'CORRECT' | 'WON' | 'ANSWERED_CORRECT' | 'INCORRECT' | 'NOT_SUBMITTED';

export interface GroupOutcome {
  questionNumber: number;
  kind: OutcomeKind;
  /** 本組送出的答案；未送出為 null */
  ownAnswers: BlankAnswer[] | null;
  /** 本組這一題的送出者暱稱（004 FR-024）；未送出或舊紀錄為 null */
  ownSubmitter: string | null;
  /** 搶答成功組別；批改完成前或無人答對為 null */
  winnerGroupId: GroupId | null;
  winnerAnswers: BlankAnswer[] | null;
  /** 搶答成功答案的送出者暱稱（004 FR-025）；批改完成前、無人答對或舊紀錄為 null */
  winnerSubmitter: string | null;
}

/**
 * 由本組送出紀錄與（批改完成後才有的）每題結果推得每題成績（research R11、R13）。
 * 所有資料都來自伺服器的 StudentView；批改完成前 results 為 null，學生拿不到其他組的答案（FR-025）。
 */
export function groupOutcomes(
  questionNumbers: readonly number[],
  results: readonly ResultView[] | null,
  ownSubmissions: readonly OwnSubmission[],
  groupId: GroupId,
): GroupOutcome[] {
  const own = new Map(ownSubmissions.map((s) => [s.questionNumber, s]));
  const resultOf = new Map((results ?? []).map((r) => [r.questionNumber, r]));
  return [...questionNumbers]
    .sort((a, b) => a - b)
    .map((questionNumber) => {
      const submission = own.get(questionNumber);
      const result = resultOf.get(questionNumber);
      let kind: OutcomeKind;
      if (submission === undefined) kind = 'NOT_SUBMITTED';
      else if (results === null) kind = submission.grading === 'CORRECT' ? 'CORRECT' : 'PENDING';
      else if (result?.winnerGroupId === groupId) kind = 'WON';
      else kind = submission.grading === 'CORRECT' ? 'ANSWERED_CORRECT' : 'INCORRECT';
      return {
        questionNumber,
        kind,
        ownAnswers: submission?.answers ?? null,
        ownSubmitter: submission?.submitterNickname ?? null,
        winnerGroupId: result?.winnerGroupId ?? null,
        winnerAnswers: result?.answers ?? null,
        winnerSubmitter: result?.submitterNickname ?? null,
      };
    });
}

/** 本組搶答成功的題數（只在批改完成後有意義）。 */
export function wonCount(outcomes: readonly GroupOutcome[]): number {
  return outcomes.filter((o) => o.kind === 'WON').length;
}
