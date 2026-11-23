import type { QuizSession } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { planExport } from '../../src/domain/export/exportPlan.js';
import { parseGuidedNotes } from '../../src/domain/guidedNotes/parser.js';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import { deriveResults } from '../../src/domain/ranking/results.js';
import type { SpreadsheetSnapshot } from '../../src/infrastructure/sheets/guidedNotesGateway.js';
import { readySession, submission } from '../helpers/builders.js';
import { loadFixture } from '../helpers/fixtures.js';

function closedSessionFor(fixture: string, submissions: QuizSession['submissions']): QuizSession {
  const parsed = parseGuidedNotes(loadFixture(fixture));
  return readySession({
    status: 'CLOSED',
    questions: parsed.questions,
    submissions,
    nextSequence: submissions.length + 1,
  });
}

function plan(session: QuizSession, snapshot: SpreadsheetSnapshot) {
  return planExport(
    session,
    deriveResults(session, new FirstSubmissionStrategy()),
    parseGuidedNotes(snapshot),
  );
}

describe('planExport', () => {
  it('單題寫入純答案，位置為作答格（合併左上角）', () => {
    const session = closedSessionFor('single-example', [submission(2, 1, 1, ['0'])]);
    expect(plan(session, loadFixture('single-example'))).toEqual({
      writes: [{ sheetTitle: '學習單', rowIndex: 6, columnIndex: 6, value: '0' }],
      writtenQuestionCount: 1,
    });
  });

  it('題組有標記時寫「（1）答案」；無人搶答的題目不產生寫入', () => {
    const session = closedSessionFor('group-example', [
      submission(1, 2, 1, ['CPU', '作業系統']),
      submission(1, 1, 2, ['GPU', 'Linux']),
    ]);
    const result = plan(session, loadFixture('group-example'));
    expect(result.writes.map((w) => [w.rowIndex, w.value])).toEqual([
      [4, '（1）CPU'],
      [5, '（2）作業系統'],
    ]);
    expect(result.writtenQuestionCount).toBe(1);
  });

  it('題組沒有標記時只寫答案', () => {
    const session = closedSessionFor('group-no-markers', [submission(2, 1, 1, ['演算法', '堆疊'])]);
    expect(plan(session, loadFixture('group-no-markers')).writes.map((w) => w.value)).toEqual([
      '演算法',
      '堆疊',
    ]);
  });

  it('作答格已有內容時直接覆寫；重複匯出時標記仍被辨識、寫入內容不變', () => {
    const session = closedSessionFor('group-example', [submission(1, 1, 1, ['CPU', 'OS'])]);
    const doc = loadFixture('group-example');
    const first = plan(session, doc);
    for (const w of first.writes) {
      const row = doc.sheets[0]?.cells[w.rowIndex];
      if (row !== undefined) row[w.columnIndex] = w.value;
    }
    const second = plan(session, doc);
    expect(second.writes).toEqual(first.writes);
  });

  it('找不到題號或子題數不同時拋 EXPORT_LOCATE_FAILED 並列出題號', () => {
    const session = closedSessionFor('group-example', [
      submission(1, 1, 1, ['a', 'b']),
      submission(3, 1, 2, ['0']),
    ]);
    const doc = loadFixture('group-example');
    const sheet = doc.sheets[0];
    if (sheet === undefined) throw new Error('fixture 缺少工作表');
    sheet.cells.splice(10, 1); // 刪掉第 3 題那一列
    try {
      plan(session, doc);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: 'EXPORT_LOCATE_FAILED' });
      expect((error as { details: { questionNumber: number }[] }).details).toEqual([
        expect.objectContaining({ questionNumber: 3 }),
      ]);
    }
  });

  it('沒有任何搶答成功的題目時寫入清單為空', () => {
    const session = closedSessionFor('single-example', []);
    expect(plan(session, loadFixture('single-example'))).toEqual({
      writes: [],
      writtenQuestionCount: 0,
    });
  });
});
