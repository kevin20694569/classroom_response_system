import type { BlankAnswer, GroupId, OwnSubmission, ResultView } from '@crs/shared';

/** 本組在某題的成績（003 FR-025）。 */
export type OutcomeKind = 'WON' | 'SUBMITTED_NOT_WON' | 'NOT_SUBMITTED';

export interface GroupOutcome {
  questionNumber: number;
  kind: OutcomeKind;
  /** 本組送出的答案；未送出為 null */
  ownAnswers: BlankAnswer[] | null;
  /** 搶答成功組別；無人搶答為 null */
  winnerGroupId: GroupId | null;
  winnerAnswers: BlankAnswer[] | null;
  /** 搶答成功答案的送出者暱稱（004 FR-025）；無人搶答或舊紀錄為 null */
  winnerSubmitter: string | null;
  /** 本組這一題的送出者暱稱（004 FR-024）；未送出或舊紀錄為 null */
  ownSubmitter: string | null;
}

/**
 * 由題目結果與本組送出紀錄推得每題成績（research R11）。
 * 所有資料都來自伺服器的 StudentView；學生拿不到其他組未搶到的答案（Clarifications Q1）。
 */
export function groupOutcomes(
  results: readonly ResultView[],
  ownSubmissions: readonly OwnSubmission[],
  groupId: GroupId,
): GroupOutcome[] {
  const own = new Map(ownSubmissions.map((s) => [s.questionNumber, s]));
  return [...results]
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .map((result) => {
      const ownSubmission = own.get(result.questionNumber);
      const ownAnswers = ownSubmission?.answers ?? null;
      const kind: OutcomeKind =
        result.winnerGroupId === groupId
          ? 'WON'
          : ownAnswers !== null
            ? 'SUBMITTED_NOT_WON'
            : 'NOT_SUBMITTED';
      return {
        questionNumber: result.questionNumber,
        kind,
        ownAnswers,
        winnerGroupId: result.winnerGroupId,
        winnerAnswers: result.answers,
        winnerSubmitter: result.submitterNickname,
        ownSubmitter: ownSubmission?.submitterNickname ?? null,
      };
    });
}

/** 本組搶答成功的題數。 */
export function wonCount(outcomes: readonly GroupOutcome[]): number {
  return outcomes.filter((o) => o.kind === 'WON').length;
}
