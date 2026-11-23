import type { ExportMode, QuizSession } from '@crs/shared';
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

function plan(
  session: QuizSession,
  snapshot: SpreadsheetSnapshot,
  mode: ExportMode = 'answers-only',
) {
  return planExport(
    session,
    deriveResults(session, new FirstSubmissionStrategy()),
    parseGuidedNotes(snapshot),
    mode,
  );
}

/** 把寫入套用到文件副本（模擬 Google Sheets），用來驗證重複匯出。 */
function apply(
  doc: SpreadsheetSnapshot,
  writes: { rowIndex: number; columnIndex: number; text: string }[],
) {
  const sheet = doc.sheets[0];
  if (sheet === undefined) throw new Error('fixture 缺少工作表');
  for (const w of writes) {
    while (sheet.cells.length <= w.rowIndex) sheet.cells.push([]);
    const row = sheet.cells[w.rowIndex] ?? [];
    while (row.length <= w.columnIndex) row.push('');
    row[w.columnIndex] = w.text;
    sheet.cells[w.rowIndex] = row;
  }
}

describe('planExport：只有答案（與 001 相同）', () => {
  it('單題寫入純答案，位置為作答格（合併左上角）', () => {
    const session = closedSessionFor('single-example', [submission(2, 1, 1, ['0'])]);
    expect(plan(session, loadFixture('single-example'))).toEqual({
      writes: [{ sheetTitle: '學習單', rowIndex: 6, columnIndex: 6, text: '0', mutedFrom: null }],
      writtenQuestionCount: 1,
    });
  });

  it('題組（真實版面）：答案寫入 H 欄填答格、不加標記，G 欄標記不動；無人搶答的題目不產生寫入（FR-025）', () => {
    const session = closedSessionFor('group-example', [
      submission(1, 2, 1, ['CPU', '作業系統']),
      submission(1, 1, 2, ['GPU', 'Linux']),
    ]);
    const result = plan(session, loadFixture('group-example'));
    expect(result.writes.map((w) => [w.rowIndex, w.columnIndex, w.text])).toEqual([
      [4, 7, 'CPU'],
      [5, 7, '作業系統'],
    ]);
    expect(result.writes.some((w) => w.columnIndex === 6)).toBe(false);
    expect(result.writtenQuestionCount).toBe(1);
  });

  it('標記與答案同格的版面：維持 001 的「（1）答案」', () => {
    const session = closedSessionFor('marker-in-answer-cell', [
      submission(1, 2, 1, ['CPU', '作業系統']),
    ]);
    const result = plan(session, loadFixture('marker-in-answer-cell'));
    expect(result.writes.map((w) => [w.rowIndex, w.columnIndex, w.text])).toEqual([
      [4, 6, '（1）CPU'],
      [5, 6, '（2）作業系統'],
    ]);
  });

  it('題組沒有標記時只寫答案', () => {
    const session = closedSessionFor('group-no-markers', [submission(2, 1, 1, ['演算法', '堆疊'])]);
    expect(plan(session, loadFixture('group-no-markers')).writes.map((w) => w.text)).toEqual([
      '演算法',
      '堆疊',
    ]);
  });

  it('作答格已有內容時直接覆寫；重複匯出時標記仍被辨識、寫入內容不變', () => {
    const session = closedSessionFor('group-example', [submission(1, 1, 1, ['CPU', 'OS'])]);
    const doc = loadFixture('group-example');
    const first = plan(session, doc);
    apply(doc, first.writes);
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

// 第 1 題由第 2 組（sequence 1）、第 3 題由第 1 組（sequence 2）搶答成功；第 2、4 題無人搶答
function groupResults(): QuizSession {
  return closedSessionFor('group-example', [
    submission(1, 2, 1, ['CPU', '作業系統']),
    submission(3, 1, 2, ['0']),
  ]);
}
const T1 = '2026/11/23 08:00:01.000';
const T2 = '2026/11/23 08:00:02.000';

describe('planExport：答案＋組別時間欄（002 FR-019）', () => {
  it('沒有結果欄時在使用範圍之後新增表頭，搶答成功寫在題目區塊第一列、無人搶答清空', () => {
    const fresh = loadFixture('group-example');
    expect(parseGuidedNotes(fresh).usedColumnCount).toBe(8);
    const { writes, writtenQuestionCount } = plan(groupResults(), fresh, 'answers-with-columns');
    expect(writtenQuestionCount).toBe(2);
    const answers = writes.filter((w) => w.columnIndex === 6 || w.columnIndex === 7);
    expect(answers.map((w) => [w.rowIndex, w.text, w.mutedFrom])).toEqual([
      [4, 'CPU', null],
      [5, '作業系統', null],
      [10, '0', null],
    ]);
    const results = writes
      .filter((w) => w.columnIndex >= 8)
      .map((w) => [w.rowIndex, w.columnIndex, w.text]);
    expect(results).toEqual([
      [3, 8, '搶答組別'],
      [3, 9, '提交時間'],
      [4, 8, '第 2 組'],
      [4, 9, T1],
      [7, 8, ''],
      [7, 9, ''],
      [10, 8, '第 1 組'],
      [10, 9, T2],
      [12, 8, ''],
      [12, 9, ''],
    ]);
  });

  it('沿用既有的結果欄，不重複新增；舊值被本次結果覆寫', () => {
    const doc = loadFixture('exported-columns');
    const { writes } = plan(groupResults(), doc, 'answers-with-columns');
    expect(writes.some((w) => w.rowIndex === 3)).toBe(false);
    expect(writes.filter((w) => w.rowIndex === 4 && w.columnIndex >= 8).map((w) => w.text)).toEqual(
      ['第 2 組', T1],
    );
  });

  it('只缺一欄時只新增那一欄', () => {
    const doc = loadFixture('exported-columns');
    const header = doc.sheets[0]?.cells[3];
    if (header === undefined) throw new Error('fixture 缺少表頭列');
    header[9] = '';
    for (const row of doc.sheets[0]?.cells ?? []) row[9] = '';
    const { writes } = plan(groupResults(), doc, 'answers-with-columns');
    expect(writes.filter((w) => w.rowIndex === 3).map((w) => [w.columnIndex, w.text])).toEqual([
      [9, '提交時間'],
    ]);
  });

  it('兩份範例：單題範例的結果欄也新增在 G:H 之後（I 欄）', () => {
    const session = closedSessionFor('single-example', [submission(2, 1, 1, ['0'])]);
    const { writes } = plan(session, loadFixture('single-example'), 'answers-with-columns');
    expect(writes.find((w) => w.text === '搶答組別')?.columnIndex).toBe(8);
    expect(writes.filter((w) => w.rowIndex === 6 && w.columnIndex >= 8).map((w) => w.text)).toEqual(
      ['第 1 組', '2026/11/23 08:00:01.000'],
    );
  });
});

describe('planExport：答案＋格內附註行（002 FR-020）', () => {
  it('單題作答格為「答案＋換行＋附註行」，mutedFrom 為換行位置', () => {
    const { writes } = plan(groupResults(), loadFixture('group-example'), 'answers-with-note-line');
    const q3 = writes.find((w) => w.rowIndex === 10);
    expect(q3?.text).toBe(`0\n〔第 1 組｜${T2}〕`);
    expect(q3?.mutedFrom).toBe(1);
  });

  it('題組只有最後一個子題有附註行', () => {
    const { writes } = plan(groupResults(), loadFixture('group-example'), 'answers-with-note-line');
    const [first, second] = writes.filter((w) => w.rowIndex === 4 || w.rowIndex === 5);
    expect(first).toMatchObject({ columnIndex: 7, text: 'CPU', mutedFrom: null });
    expect(second?.columnIndex).toBe(7);
    expect(second?.text).toBe(`作業系統\n〔第 2 組｜${T1}〕`);
    expect(second?.mutedFrom).toBe('作業系統'.length);
  });

  it('已有附註行的文件：標記仍被辨識，重複匯出內容相同、不累加', () => {
    const doc = loadFixture('exported-note-line');
    const first = plan(groupResults(), doc, 'answers-with-note-line');
    apply(doc, first.writes);
    const second = plan(groupResults(), doc, 'answers-with-note-line');
    expect(second.writes).toEqual(first.writes);
    expect(second.writes.every((w) => (w.text.match(/〔/g) ?? []).length <= 1)).toBe(true);
  });

  it('單題範例同樣適用', () => {
    const session = closedSessionFor('single-example', [submission(1, 2, 1, ['CPU'])]);
    const { writes } = plan(session, loadFixture('single-example'), 'answers-with-note-line');
    expect(writes).toEqual([
      {
        sheetTitle: '學習單',
        rowIndex: 4,
        columnIndex: 6,
        text: 'CPU\n〔第 2 組｜2026/11/23 08:00:01.000〕',
        mutedFrom: 3,
      },
    ]);
  });
});

describe('planExport：三種模式共通', () => {
  it.each<ExportMode>(['answers-only', 'answers-with-columns', 'answers-with-note-line'])(
    '%s：無人搶答題目的作答格不寫入；重複匯出後文件內容相同',
    (mode) => {
      const doc = loadFixture('group-example');
      const first = plan(groupResults(), doc, mode);
      expect(
        first.writes.some(
          (w) =>
            (w.columnIndex === 6 || w.columnIndex === 7) &&
            (w.rowIndex === 7 || w.rowIndex === 8 || w.rowIndex === 12),
        ),
      ).toBe(false);
      expect(first.writtenQuestionCount).toBe(2);
      apply(doc, first.writes);
      const afterFirst = structuredClone(doc);
      // 第二次匯出（結果欄表頭已存在，不再重寫）後，文件內容與第一次完全相同
      apply(doc, plan(groupResults(), doc, mode).writes);
      expect(doc).toEqual(afterFirst);
    },
  );

  it.each<ExportMode>(['answers-with-columns', 'answers-with-note-line'])(
    '%s：任一題無法定位時不回傳任何寫入（含結果欄表頭）',
    (mode) => {
      const doc = loadFixture('group-example');
      doc.sheets[0]?.cells.splice(10, 1);
      expect(() => plan(groupResults(), doc, mode)).toThrow(
        expect.objectContaining({ code: 'EXPORT_LOCATE_FAILED' }),
      );
    },
  );

  it('匯出後的文件重新解析，題數、題型、標記與作答格位置不變（FR-023）', () => {
    const base = parseGuidedNotes(loadFixture('group-example'));
    for (const name of ['exported-columns', 'exported-note-line']) {
      const parsed = parseGuidedNotes(loadFixture(name));
      expect(
        parsed.questions.map((q) => [q.number, q.kind, q.blanks.map((b) => [b.label, b.location])]),
      ).toEqual(
        base.questions.map((q) => [q.number, q.kind, q.blanks.map((b) => [b.label, b.location])]),
      );
    }
  });
});
