import { randomUUID } from 'node:crypto';
import { groupName, type Question, type QuizSession, type Submission } from '@crs/shared';
import { initialSession } from '../../src/domain/session/quizSession.js';

/** 測試用的題目：單題與題組。 */
export function singleQuestion(number: number, row = number * 2): Question {
  return {
    number,
    order: number,
    kind: 'single',
    blanks: [
      {
        index: 1,
        label: null,
        location: { sheetTitle: '學習單', rowIndex: row, columnIndex: 6 },
        prompt: null,
        labelInAnswerCell: true,
      },
    ],
    prompt: `第 ${number} 題的敘述`,
  };
}

export function groupQuestion(number: number, row = number * 3): Question {
  return {
    number,
    order: number,
    kind: 'group',
    blanks: [
      {
        index: 1,
        label: '（1）',
        location: { sheetTitle: '學習單', rowIndex: row, columnIndex: 6 },
        prompt: `第 ${number} 題子題一的敘述`,
        labelInAnswerCell: true,
      },
      {
        index: 2,
        label: '（2）',
        location: { sheetTitle: '學習單', rowIndex: row + 1, columnIndex: 6 },
        prompt: `第 ${number} 題子題二的敘述`,
        labelInAnswerCell: true,
      },
    ],
    prompt: null,
  };
}

/** 已匯入（READY）的活動。 */
export function readySession(overrides: Partial<QuizSession> = {}): QuizSession {
  const groupCount = 2;
  return {
    ...initialSession(),
    activityId: randomUUID(),
    status: 'READY',
    source: { spreadsheetId: 'sheet-single', sheetTitle: '學習單' },
    groups: Array.from({ length: groupCount }, (_, i) => ({ id: i + 1, name: groupName(i + 1) })),
    questions: [singleQuestion(1), singleQuestion(2), groupQuestion(3)],
    ...overrides,
  };
}

export function submission(
  questionNumber: number,
  groupId: number,
  sequence: number,
  texts: string[] = ['答案'],
  submitterNickname: string | null = null,
  /**
   * 預設視為老師已勾選答對：讓「已結束」的結果沿用 001～003「最先送出即搶答成功」的測試情境；
   * 測試批改規則（004）時再明確傳入 false。
   */
  correct = true,
): Submission {
  return {
    id: randomUUID(),
    questionNumber,
    groupId,
    answers: texts.map((text, i) => ({ blankIndex: i + 1, text })),
    sequence,
    receivedAt: new Date(Date.UTC(2026, 10, 23, 0, 0, sequence)).toISOString(),
    submitterNickname,
    correct,
  };
}
