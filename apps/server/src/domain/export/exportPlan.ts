import {
  groupName,
  type Blank,
  type BlankAnswer,
  type ErrorDetail,
  type ExportMode,
  type Question,
  type QuestionResult,
  type QuizSession,
  type Submission,
} from '@crs/shared';
import type { CellWrite } from '../../infrastructure/sheets/guidedNotesGateway.js';
import { DomainError } from '../errors.js';
import type { ParsedGuidedNotes } from '../guidedNotes/parser.js';
import { formatSubmittedAt } from './submittedAt.js';

export interface ExportPlan {
  writes: CellWrite[];
  /** 搶答成功、已寫入答案的題數 */
  writtenQuestionCount: number;
}

const HEADER_RESULT_GROUP = '搶答組別';
const HEADER_RESULT_TIME = '提交時間';

/** 答案值（三種模式共用，同 001）：題組子題目前有「（n）」標記時寫「標記原文＋答案」，否則只寫答案。 */
function answerValue(question: Question, blank: Blank, answer: BlankAnswer): string {
  return question.kind === 'group' && blank.label !== null
    ? `${blank.label}${answer.text}`
    : answer.text;
}

/**
 * 附註行（「答案＋格內附註行」模式，FR-020）：以全形括號與「｜」包住組別與時間，
 * 加上較小灰色字（mutedFrom），在文字與樣式上都和答案明顯不同（FR-018）。
 */
function attribution(winner: Submission): string {
  return `〔${groupName(winner.groupId)}｜${formatSubmittedAt(winner.receivedAt)}〕`;
}

interface Located {
  question: Question;
  winner: Submission | null;
}

/**
 * 計算匯出要寫入的儲存格（002 contracts/guided-notes-format.md §B，FR-017～FR-022）。
 *
 * - 一律以「匯出當下重新解析」的結果定位，不使用匯入時保存的位置（文件可能已被修改）。
 * - 先完成全部定位；任何搶答成功的題目無法定位時整次不寫入（EXPORT_LOCATE_FAILED），
 *   連結果欄的表頭也不會新增，避免只寫了一半。
 * - 無人搶答的題目，作答格一律不動；同一模式重複匯出時寫入內容完全相同。
 */
export function planExport(
  session: Readonly<QuizSession>,
  results: readonly QuestionResult[],
  fresh: ParsedGuidedNotes,
  mode: ExportMode,
): ExportPlan {
  const located: Located[] = [];
  const unlocated: ErrorDetail[] = [];

  for (const result of results) {
    const current = fresh.questions.find((q) => q.number === result.questionNumber);
    if (result.winner === null) {
      // 無人搶答：作答格不動；欄位模式仍需知道它在文件中的位置以清空結果欄（找不到就略過）
      if (current !== undefined) located.push({ question: current, winner: null });
      continue;
    }
    const original = session.questions.find((q) => q.number === result.questionNumber);
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
    located.push({ question: current, winner: result.winner });
  }

  if (unlocated.length > 0) {
    throw new DomainError(
      'EXPORT_LOCATE_FAILED',
      '有題目在文件中無法定位，為避免寫錯位置，這次沒有寫入任何內容。',
      unlocated,
    );
  }

  const writes: CellWrite[] = [];
  let writtenQuestionCount = 0;
  for (const { question, winner } of located) {
    if (winner === null) continue;
    const lastIndex = question.blanks.length - 1;
    question.blanks.forEach((blank, i) => {
      const answer = winner.answers.find((a) => a.blankIndex === blank.index);
      if (answer === undefined) return;
      const value = answerValue(question, blank, answer);
      // 附註行只加在單題的作答格，或題組最後一個子題的作答格（題組只記錄一次）
      const withNote = mode === 'answers-with-note-line' && i === lastIndex;
      writes.push({
        ...blank.location,
        text: withNote ? `${value}\n${attribution(winner)}` : value,
        mutedFrom: withNote ? value.length : null,
      });
    });
    writtenQuestionCount += 1;
  }

  if (mode === 'answers-with-columns') {
    writes.push(...resultColumnWrites(fresh, located));
  }
  return { writes, writtenQuestionCount };
}

/**
 * 「答案＋組別時間欄」模式（FR-019）：
 * - 沿用表頭列既有的「搶答組別」「提交時間」欄；缺少的欄依序新增在使用範圍之後（不覆蓋任何內容）。
 * - 每題寫在題目區塊第一列（該題作答格最上方的列）；題組只寫一次。
 * - 搶答成功寫入組別與提交時間；無人搶答清空這兩格（避免留下上一場的結果）。
 */
function resultColumnWrites(fresh: ParsedGuidedNotes, located: readonly Located[]): CellWrite[] {
  const writes: CellWrite[] = [];
  let nextColumn = fresh.usedColumnCount;
  const ensureColumn = (existing: number | null, header: string): number => {
    if (existing !== null) return existing;
    const column = nextColumn;
    nextColumn += 1;
    writes.push({
      sheetTitle: fresh.sheetTitle,
      rowIndex: fresh.headerRowIndex,
      columnIndex: column,
      text: header,
      mutedFrom: null,
    });
    return column;
  };
  const groupColumn = ensureColumn(fresh.resultColumns.groupColumn, HEADER_RESULT_GROUP);
  const timeColumn = ensureColumn(fresh.resultColumns.timeColumn, HEADER_RESULT_TIME);

  for (const { question, winner } of located) {
    const firstRow = Math.min(...question.blanks.map((b) => b.location.rowIndex));
    const cell = (columnIndex: number, text: string): CellWrite => ({
      sheetTitle: fresh.sheetTitle,
      rowIndex: firstRow,
      columnIndex,
      text,
      mutedFrom: null,
    });
    writes.push(
      cell(groupColumn, winner === null ? '' : groupName(winner.groupId)),
      cell(timeColumn, winner === null ? '' : formatSubmittedAt(winner.receivedAt)),
    );
  }
  return writes;
}
