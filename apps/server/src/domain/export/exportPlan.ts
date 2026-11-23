import type { ErrorDetail, QuestionResult, QuizSession } from '@crs/shared';
import type { CellWrite } from '../../infrastructure/sheets/guidedNotesGateway.js';
import { DomainError } from '../errors.js';
import type { ParsedGuidedNotes } from '../guidedNotes/parser.js';

export interface ExportPlan {
  writes: CellWrite[];
  writtenQuestionCount: number;
}

/**
 * 計算匯出要寫入的儲存格（contracts/guided-notes-format.md §7，FR-021～FR-024）。
 *
 * - 一律以「匯出當下重新解析」的結果定位填空格，不使用匯入時保存的位置（文件可能已被修改）。
 * - 依題號對應；找不到該題或子題數與匯入時不同 → 該題無法定位。
 * - 有任何題目無法定位時整次不寫入（EXPORT_LOCATE_FAILED），避免只寫了一半。
 * - 單題寫入答案；題組子題的作答格目前有「（n）」標記時寫「標記原文＋答案」，沒有標記時只寫答案。
 * - 只寫入搶答成功題目的作答格；無人搶答的題目與文件其他儲存格一律不動，既有內容直接覆寫。
 * 因為標記會保留，重複匯出時寫入的內容相同（FR-024）。
 */
export function planExport(
  session: Readonly<QuizSession>,
  results: readonly QuestionResult[],
  fresh: ParsedGuidedNotes,
): ExportPlan {
  const writes: CellWrite[] = [];
  const unlocated: ErrorDetail[] = [];
  let writtenQuestionCount = 0;

  for (const result of results) {
    const winner = result.winner;
    if (winner === null) continue;
    const original = session.questions.find((q) => q.number === result.questionNumber);
    const current = fresh.questions.find((q) => q.number === result.questionNumber);
    if (
      original === undefined ||
      current === undefined ||
      current.blanks.length !== original.blanks.length
    ) {
      unlocated.push({
        code: 'QUESTION_NOT_LOCATED',
        message:
          current === undefined
            ? '在文件中找不到這一題，可能已被刪除或題號被修改'
            : '這一題的填空格數量與匯入時不同',
        questionNumber: result.questionNumber,
      });
      continue;
    }
    for (const blank of current.blanks) {
      const answer = winner.answers.find((a) => a.blankIndex === blank.index);
      if (answer === undefined) continue;
      const value =
        current.kind === 'group' && blank.label !== null
          ? `${blank.label}${answer.text}`
          : answer.text;
      writes.push({
        sheetTitle: blank.location.sheetTitle,
        rowIndex: blank.location.rowIndex,
        columnIndex: blank.location.columnIndex,
        value,
      });
    }
    writtenQuestionCount += 1;
  }

  if (unlocated.length > 0) {
    throw new DomainError(
      'EXPORT_LOCATE_FAILED',
      '有題目在文件中無法定位，為避免寫錯位置，這次沒有寫入任何內容。',
      unlocated,
    );
  }
  return { writes, writtenQuestionCount };
}
