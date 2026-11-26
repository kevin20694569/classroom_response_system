import { CSV_NO_ANSWER_TEXT, groupName, type QuizSession } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { CsvResultExporter } from '../../src/domain/export/csv/csvResultExporter.js';
import { buildResultRows, toCsvRecord } from '../../src/domain/export/csv/resultRows.js';
import { formatCsvSubmittedAt } from '../../src/domain/export/csv/csvSubmittedAt.js';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import { deriveResults } from '../../src/domain/ranking/results.js';
import { groupQuestion, readySession, singleQuestion, submission } from '../helpers/builders.js';

const ranking = new FirstSubmissionStrategy();

function rowsOf(session: QuizSession) {
  return buildResultRows(session, ranking, deriveResults(session, ranking));
}

describe('buildResultRows（單題，FR-006）', () => {
  const second = submission(1, 2, 1, ['CPU'], '小華');
  const first = submission(1, 1, 2, ['GPU'], null);
  const other = submission(2, 3, 3, ['記憶體'], '阿明');
  const session = readySession({
    status: 'CLOSED',
    questions: [singleQuestion(1), singleQuestion(2)],
    submissions: [first, other, second],
  });

  it('依題號由小到大，同題依順位排序', () => {
    const rows = rowsOf(session);
    expect(rows.map((r) => [r.questionNumber, r.groupLabel])).toEqual([
      [1, '第 2 組'],
      [1, '第 1 組'],
      [2, '第 3 組'],
    ]);
  });

  it('順位、送出時間與搶答成功', () => {
    const rows = rowsOf(session);
    expect(rows.map((r) => r.rankLabel)).toEqual(['第 1 名', '第 2 名', '第 1 名']);
    expect(rows[0]?.submittedAt).toBe(formatCsvSubmittedAt(second.receivedAt));
    expect(rows.map((r) => r.isWinner)).toEqual(['是', '否', '是']);
  });

  it('單題的子題欄為 null，暱稱與答案原樣帶入', () => {
    const rows = rowsOf(session);
    expect(rows[0]).toMatchObject({ blankLabel: null, submitterNickname: '小華', answer: 'CPU' });
    expect(rows[1]?.submitterNickname).toBeNull();
  });

  it('toCsvRecord 依表頭順序輸出 8 欄', () => {
    const record = toCsvRecord(rowsOf(session)[0] as NonNullable<ReturnType<typeof rowsOf>[0]>);
    expect(record).toEqual([
      '1',
      null,
      '第 2 組',
      '小華',
      'CPU',
      '第 1 名',
      formatCsvSubmittedAt(second.receivedAt),
      '是',
    ]);
  });
});

describe('buildResultRows（題組與無人作答，FR-006～FR-008）', () => {
  it('題組每筆送出依子題拆列、相鄰，其餘欄位相同', () => {
    const g3 = submission(1, 3, 1, ['CPU', '作業系統'], '甲');
    const g1 = submission(1, 1, 2, ['GPU', '核心'], '乙');
    const rows = rowsOf(
      readySession({ status: 'CLOSED', questions: [groupQuestion(1)], submissions: [g1, g3] }),
    );
    expect(rows.map((r) => [r.groupLabel, r.blankLabel, r.answer, r.isWinner])).toEqual([
      ['第 3 組', '子題1', 'CPU', '是'],
      ['第 3 組', '子題2', '作業系統', '是'],
      ['第 1 組', '子題1', 'GPU', '否'],
      ['第 1 組', '子題2', '核心', '否'],
    ]);
    expect(rows[0]?.rankLabel).toBe(rows[1]?.rankLabel);
    expect(rows[0]?.submittedAt).toBe(rows[1]?.submittedAt);
  });

  it('文件沒有標記時仍為「子題N」；缺少某子題答案時答案為空字串', () => {
    const base = groupQuestion(1);
    const question = {
      ...base,
      blanks: base.blanks.map((blank) => ({ ...blank, label: null })),
    };
    const rows = rowsOf(
      readySession({
        status: 'CLOSED',
        questions: [question],
        submissions: [submission(1, 1, 1, ['只有第一個'])],
      }),
    );
    expect(rows.map((r) => [r.blankLabel, r.answer])).toEqual([
      ['子題1', '只有第一個'],
      ['子題2', ''],
    ]);
  });

  it('不論文件標記是「(1)」「（1）」或其他寫法，一律輸出「子題N」（Excel 會把括號數字轉成 -1）', () => {
    const base = groupQuestion(1);
    const question = {
      ...base,
      blanks: base.blanks.map((blank, i) => ({ ...blank, label: `(${String(i + 1)})` })),
    };
    const rows = rowsOf(
      readySession({
        status: 'CLOSED',
        questions: [question],
        submissions: [submission(1, 1, 1, ['甲', '乙'])],
      }),
    );
    expect(rows.map((r) => r.blankLabel)).toEqual(['子題1', '子題2']);
    for (const r of rows) expect(r.blankLabel).not.toMatch(/[()（）]|\d-\d/);
  });

  it('送出時間為 YYYY-MM-DD HH:mm:ss，不含毫秒', () => {
    const rows = rowsOf(
      readySession({
        status: 'CLOSED',
        questions: [singleQuestion(1)],
        submissions: [submission(1, 1, 1)],
      }),
    );
    expect(rows[0]?.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('無人作答的題目（單題與題組）恰好一列，其他欄位為 null', () => {
    const rows = rowsOf(
      readySession({
        status: 'CLOSED',
        questions: [singleQuestion(1), groupQuestion(2)],
        submissions: [],
      }),
    );
    expect(rows).toEqual([
      {
        questionNumber: 1,
        blankLabel: null,
        groupLabel: null,
        submitterNickname: null,
        answer: CSV_NO_ANSWER_TEXT,
        rankLabel: null,
        submittedAt: null,
        isWinner: null,
      },
      {
        questionNumber: 2,
        blankLabel: null,
        groupLabel: null,
        submitterNickname: null,
        answer: CSV_NO_ANSWER_TEXT,
        rankLabel: null,
        submittedAt: null,
        isWinner: null,
      },
    ]);
  });

  it('題號不連續且 questions 順序打亂時依題號排序，不補不存在的題號', () => {
    const rows = rowsOf(
      readySession({
        status: 'CLOSED',
        questions: [singleQuestion(5), singleQuestion(1), singleQuestion(2)],
        submissions: [submission(5, 1, 1), submission(1, 2, 2)],
      }),
    );
    expect(rows.map((r) => r.questionNumber)).toEqual([1, 2, 5]);
    expect(rows[1]?.answer).toBe(CSV_NO_ANSWER_TEXT);
  });

  it('單題的 submitterNickname 為 null 時保持 null', () => {
    const rows = rowsOf(
      readySession({
        status: 'CLOSED',
        questions: [singleQuestion(1)],
        submissions: [submission(1, 1, 1, ['答'], null)],
      }),
    );
    expect(rows[0]?.submitterNickname).toBeNull();
  });
});

describe('大量資料（Edge Cases：20 組 × 30 題）', () => {
  const groupCount = 20;
  const questionCount = 30;
  const questions = Array.from({ length: questionCount }, (_, i) => singleQuestion(i + 1));
  // 每題由 20 組全部作答；順位（sequence）刻意倒著給，確認依順位而非組別排序
  const submissions = questions.flatMap((q) =>
    Array.from({ length: groupCount }, (_, i) =>
      submission(q.number, i + 1, groupCount - i, [`答${String(q.number)}-${String(i + 1)}`]),
    ),
  );
  const session = readySession({
    status: 'CLOSED',
    openedAt: new Date(Date.UTC(2026, 10, 23, 0, 0, 0)).toISOString(),
    groups: Array.from({ length: groupCount }, (_, i) => ({ id: i + 1, name: groupName(i + 1) })),
    questions,
    submissions,
  });

  it('列數恰為 600，每題 20 列且依順位排序、沒有截斷', () => {
    const rows = rowsOf(session);
    expect(rows).toHaveLength(groupCount * questionCount);
    for (const q of questions) {
      const qRows = rows.filter((r) => r.questionNumber === q.number);
      expect(qRows).toHaveLength(groupCount);
      expect(qRows.map((r) => r.rankLabel)).toEqual(
        Array.from({ length: groupCount }, (_, i) => `第 ${String(i + 1)} 名`),
      );
      // sequence 1 對應第 20 組，因此組別由 20 往 1 排列
      expect(qRows[0]?.groupLabel).toBe('第 20 組');
      expect(qRows[groupCount - 1]?.groupLabel).toBe('第 1 組');
    }
  });

  it('CsvResultExporter 的 rowCount 為 600', async () => {
    const exported = await new CsvResultExporter(ranking).export(
      session,
      deriveResults(session, ranking),
      'answers-with-columns',
    );
    expect(exported.rowCount).toBe(600);
  });
});
