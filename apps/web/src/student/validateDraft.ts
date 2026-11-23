import {
  ANSWER_MAX_LENGTH,
  unicodeLength,
  type BlankAnswer,
  type ErrorCode,
  type ErrorDetail,
  type QuestionSummary,
} from '@crs/shared';

/** 送出前檢查的問題（003 data-model §3）。 */
export interface DraftIssue {
  blankIndex: number;
  kind: 'EMPTY' | 'TOO_LONG';
  message: string;
}

/** 一次送出的結果（003 data-model §3）。 */
export type SubmitOutcome =
  | { kind: 'SUBMITTED'; answers: BlankAnswer[] }
  | { kind: 'INVALID_DRAFT'; issues: DraftIssue[] }
  | {
      kind: 'REJECTED';
      code: ErrorCode | 'NETWORK_ERROR';
      message: string;
      details: readonly ErrorDetail[];
    }
  | { kind: 'IGNORED' };

/**
 * 子題名稱（research R5）：有標記用 Guided Notes 的標記原文；
 * 題組沒有標記時用「（n）」讓輸入欄可區分；單題不顯示標記。
 */
export function blankLabelOf(question: QuestionSummary, index: number): string | null {
  const label = question.blankLabels[index - 1] ?? null;
  if (label !== null) return label;
  return question.kind === 'group' ? `（${index}）` : null;
}

/**
 * 送出前檢查（003 FR-014）：去除前後空白後 1～200 字，題組每個子題都要填。
 * 字數以 shared 的 unicodeLength 計算，與伺服器 validateAnswers 同一套規則；伺服器仍做最終判定。
 */
export function validateDraft(question: QuestionSummary, texts: readonly string[]): DraftIssue[] {
  const issues: DraftIssue[] = [];
  for (let index = 1; index <= question.blankCount; index += 1) {
    const length = unicodeLength((texts[index - 1] ?? '').trim());
    const label = blankLabelOf(question, index) ?? '';
    if (length < 1) issues.push({ blankIndex: index, kind: 'EMPTY', message: `${label}尚未填寫` });
    else if (length > ANSWER_MAX_LENGTH) {
      issues.push({
        blankIndex: index,
        kind: 'TOO_LONG',
        message: `${label}超過 ${ANSWER_MAX_LENGTH} 字`,
      });
    }
  }
  return issues;
}
