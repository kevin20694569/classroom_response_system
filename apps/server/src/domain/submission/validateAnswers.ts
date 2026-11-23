import {
  ANSWER_MAX_LENGTH,
  unicodeLength,
  type BlankAnswer,
  type ErrorDetail,
  type Question,
} from '@crs/shared';
import { DomainError } from '../errors.js';

/**
 * 驗證一次送出的答案（data-model.md「送出規則」第 3、4 條）：
 * 3. answers 必須恰好涵蓋該題所有子題、每個子題一次；題組不得只送部分子題（FR-017）。
 * 4. 每個答案去除前後空白後 1～200 字（以 Unicode 字元計，FR-017a）。
 * 回傳去除前後空白後、依子題序號排序的答案。
 */
export function validateAnswers(
  question: Question,
  answers: readonly { blankIndex: number; text: string }[],
): BlankAnswer[] {
  const expected = question.blanks.map((b) => b.index);
  const provided = answers.map((a) => a.blankIndex);
  const complete =
    provided.length === expected.length &&
    new Set(provided).size === provided.length &&
    expected.every((index) => provided.includes(index));
  if (!complete) {
    const missing = expected.filter((index) => !provided.includes(index));
    throw new DomainError(
      'ANSWER_INCOMPLETE',
      question.kind === 'group'
        ? `第 ${question.number} 題是題組，必須同時送出所有子題的答案。`
        : `第 ${question.number} 題必須送出一個答案。`,
      missing.map((blankIndex) => ({
        code: 'MISSING_ANSWER',
        message: '缺少這個子題的答案',
        questionNumber: question.number,
        blankIndex,
      })),
    );
  }

  const issues: ErrorDetail[] = [];
  const cleaned = answers.map((a) => {
    const text = a.text.trim();
    const length = unicodeLength(text);
    if (length < 1 || length > ANSWER_MAX_LENGTH) {
      issues.push({
        code: length < 1 ? 'EMPTY_ANSWER' : 'ANSWER_TOO_LONG',
        message: length < 1 ? '答案不能空白' : `答案不能超過 ${ANSWER_MAX_LENGTH} 字`,
        questionNumber: question.number,
        blankIndex: a.blankIndex,
      });
    }
    return { blankIndex: a.blankIndex, text };
  });
  if (issues.length > 0) {
    throw new DomainError(
      'ANSWER_INVALID',
      `答案需為 1～${ANSWER_MAX_LENGTH} 字，請修正後再送出。`,
      issues,
    );
  }
  return cleaned.sort((a, b) => a.blankIndex - b.blankIndex);
}
