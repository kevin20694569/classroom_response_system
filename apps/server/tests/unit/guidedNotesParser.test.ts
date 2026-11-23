import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import { parseGuidedNotes } from '../../src/domain/guidedNotes/parser.js';
import { loadFixture } from '../helpers/fixtures.js';

function issuesOf(name: string) {
  try {
    parseGuidedNotes(loadFixture(name));
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('GUIDED_NOTES_INVALID');
    return (error as DomainError).details ?? [];
  }
  throw new Error(`預期 ${name} 匯入失敗`);
}

describe('課程範例（contracts/guided-notes-format.md §8 驗收基準）', () => {
  it('單題範例：題號 1～6，皆為單題，作答格位於 G 欄合併左上角', () => {
    const { sheetTitle, questions } = parseGuidedNotes(loadFixture('single-example'));
    expect(sheetTitle).toBe('學習單');
    expect(questions.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(questions.every((q) => q.kind === 'single' && q.blanks.length === 1)).toBe(true);
    expect(questions[0]?.blanks[0]).toEqual({
      index: 1,
      label: null,
      location: { sheetTitle: '學習單', rowIndex: 4, columnIndex: 6 },
      prompt: null,
      labelInAnswerCell: true,
    });
    expect(questions.map((q) => q.blanks[0]?.location.rowIndex)).toEqual([4, 6, 8, 10, 12, 14]);
    expect(questions.map((q) => q.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('題組範例：4 題，第 1、2 題為題組各 2 子題（標記（1）（2）），第 3、4 題為單題', () => {
    const { questions } = parseGuidedNotes(loadFixture('group-example'));
    expect(questions.map((q) => [q.number, q.kind, q.blanks.length])).toEqual([
      [1, 'group', 2],
      [2, 'group', 2],
      [3, 'single', 1],
      [4, 'single', 1],
    ]);
    expect(questions[0]?.blanks.map((b) => b.label)).toEqual(['（1）', '（2）']);
    expect(questions[0]?.blanks.map((b) => b.location.rowIndex)).toEqual([4, 5]);
    expect(questions[2]?.blanks[0]?.label).toBeNull();
    // 兩份範例同一題號的列號不同，證明沒有寫死位置
    expect(questions[2]?.blanks[0]?.location.rowIndex).toBe(10);
  });
});

describe('變體', () => {
  it('題組作答格沒有標記時仍依結構辨識為題組', () => {
    const { questions } = parseGuidedNotes(loadFixture('group-no-markers'));
    expect(questions[0]?.kind).toBe('group');
    expect(questions[0]?.blanks.map((b) => b.label)).toEqual([null, null]);
  });

  it('題號寫成 Q1、第2題、全形３、4.、5、、q6 都能辨識', () => {
    const { questions } = parseGuidedNotes(loadFixture('varied-numbers'));
    expect(questions.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('多個工作表時只使用含表頭的那一張', () => {
    const { sheetTitle, questions } = parseGuidedNotes(loadFixture('extra-sheets'));
    expect(sheetTitle).toBe('學習單');
    expect(questions).toHaveLength(6);
  });

  it('題組題號以合併儲存格跨列時同樣辨識為題組', () => {
    const { questions } = parseGuidedNotes(loadFixture('merged-group-number'));
    expect(questions.map((q) => [q.number, q.kind])).toEqual([
      [1, 'group'],
      [2, 'group'],
      [3, 'single'],
      [4, 'single'],
    ]);
  });
});

describe('錯誤（全部回報並指出位置，FR-010）', () => {
  it.each([
    ['no-header', 'HEADER_NOT_FOUND'],
    ['header-wrong-word', 'HEADER_NOT_FOUND'],
    ['multiple-header-sheets', 'MULTIPLE_GUIDED_NOTES_SHEETS'],
    ['multiple-header-rows', 'MULTIPLE_HEADER_ROWS'],
    ['invalid-number', 'INVALID_QUESTION_NUMBER'],
    ['duplicate-number', 'DUPLICATE_QUESTION_NUMBER'],
    ['no-questions', 'NO_QUESTIONS'],
    ['partial-markers', 'PARTIAL_BLANK_MARKERS'],
    ['invalid-markers', 'INVALID_BLANK_MARKERS'],
  ])('%s → %s', (fixture, code) => {
    const issues = issuesOf(fixture);
    expect(issues.map((i) => i.code)).toContain(code);
  });

  it('題號無法辨識時指出工作表、1 起算列號與欄名', () => {
    const issue = issuesOf('invalid-number').find((i) => i.code === 'INVALID_QUESTION_NUMBER');
    expect(issue).toMatchObject({ sheetTitle: '學習單', row: 9, column: 'B' });
  });

  it('多張工作表含表頭時列出工作表名稱', () => {
    const issue = issuesOf('multiple-header-sheets')[0];
    expect(issue?.message).toContain('學習單');
    expect(issue?.message).toContain('學習單副本');
  });

  it('題號重複時指出題號', () => {
    const issue = issuesOf('duplicate-number').find((i) => i.code === 'DUPLICATE_QUESTION_NUMBER');
    expect(issue?.questionNumber).toBe(2);
    expect(issue?.row).toBe(11);
  });

  it('標記錯誤時指出題號', () => {
    expect(issuesOf('partial-markers')[0]?.questionNumber).toBe(1);
    expect(issuesOf('invalid-markers')[0]?.questionNumber).toBe(1);
  });

  it('有多個錯誤時一次全部回報', () => {
    const snapshot = loadFixture('single-example');
    const sheet = snapshot.sheets[0];
    if (sheet === undefined) throw new Error('fixture 缺少工作表');
    const [row5, row9] = [sheet.cells[4], sheet.cells[8]];
    if (row5 === undefined || row9 === undefined) throw new Error('fixture 列數不足');
    row5[1] = 'A-1';
    row9[1] = '一';
    try {
      parseGuidedNotes(snapshot);
      expect.unreachable();
    } catch (error) {
      const codes = ((error as DomainError).details ?? []).map((d) => d.code);
      expect(codes.filter((c) => c === 'INVALID_QUESTION_NUMBER')).toHaveLength(2);
    }
  });
});

describe('表頭列與結果欄資訊（002 research R9）', () => {
  it('課程範例（真實版面）：表頭列為第 4 列、使用範圍 8 欄（作答 G:H）、沒有結果欄', () => {
    for (const name of ['single-example', 'group-example']) {
      const parsed = parseGuidedNotes(loadFixture(name));
      expect(parsed.headerRowIndex).toBe(3);
      expect(parsed.usedColumnCount).toBe(8);
      expect(parsed.resultColumns).toEqual({ groupColumn: null, timeColumn: null });
    }
  });

  it('已匯出過結果欄的文件：辨識 I、J 欄，題目判斷與題組範例相同（FR-023）', () => {
    const parsed = parseGuidedNotes(loadFixture('exported-columns'));
    expect(parsed.resultColumns).toEqual({ groupColumn: 8, timeColumn: 9 });
    expect(parsed.usedColumnCount).toBe(10);
    expect(parsed.questions.map((q) => [q.number, q.kind, q.blanks.length])).toEqual([
      [1, 'group', 2],
      [2, 'group', 2],
      [3, 'single', 1],
      [4, 'single', 1],
    ]);
  });

  it('作答格含附註行的文件：子題標記仍被辨識（FR-023）', () => {
    const parsed = parseGuidedNotes(loadFixture('exported-note-line'));
    expect(parsed.questions[0]?.blanks.map((b) => b.label)).toEqual(['（1）', '（2）']);
    expect(parsed.questions).toHaveLength(4);
  });
});

describe('作答區與填答格（002 contracts §A0，FR-025）', () => {
  it('題組範例（真實版面）：子題填答格為 H 欄，標記讀自 G 欄且不在填答格內', () => {
    const { questions } = parseGuidedNotes(loadFixture('group-example'));
    const [q1, q2, q3, q4] = questions;
    expect(
      q1?.blanks.map((b) => [
        b.label,
        b.location.rowIndex,
        b.location.columnIndex,
        b.labelInAnswerCell,
      ]),
    ).toEqual([
      ['（1）', 4, 7, false],
      ['（2）', 5, 7, false],
    ]);
    expect(q2?.blanks.map((b) => [b.location.rowIndex, b.location.columnIndex])).toEqual([
      [7, 7],
      [8, 7],
    ]);
    // 單題的作答格為 G:H 合併，填答格為左上角 G 欄
    expect([q3?.blanks[0]?.location.columnIndex, q4?.blanks[0]?.location.columnIndex]).toEqual([
      6, 6,
    ]);
  });

  it('單題範例（真實版面）：每題一列，填答格為 G:H 合併的左上角', () => {
    const { questions } = parseGuidedNotes(loadFixture('single-example'));
    expect(
      questions.map((q) => [q.blanks[0]?.location.rowIndex, q.blanks[0]?.location.columnIndex]),
    ).toEqual([
      [4, 6],
      [6, 6],
      [8, 6],
      [10, 6],
      [12, 6],
      [14, 6],
    ]);
  });

  it('標記與答案同格的版面（作答區只有一欄）：維持 001 行為', () => {
    const { questions } = parseGuidedNotes(loadFixture('marker-in-answer-cell'));
    expect(
      questions[0]?.blanks.map((b) => [b.label, b.location.columnIndex, b.labelInAnswerCell]),
    ).toEqual([
      ['（1）', 6, true],
      ['（2）', 6, true],
    ]);
    const twoRow = parseGuidedNotes(loadFixture('single-two-row-layout'));
    expect(twoRow.questions).toHaveLength(6);
    expect(twoRow.questions.every((q) => q.blanks[0]?.location.columnIndex === 6)).toBe(true);
  });

  it('真實版面的題組只有部分子題有標記時仍回報 PARTIAL_BLANK_MARKERS', () => {
    const doc = loadFixture('group-example');
    const row = doc.sheets[0]?.cells[5];
    if (row === undefined) throw new Error('fixture 缺少列');
    row[6] = '';
    try {
      parseGuidedNotes(doc);
      expect.unreachable();
    } catch (error) {
      const details = (error as { details: { code: string }[] }).details;
      expect(details.map((d) => d.code)).toContain('PARTIAL_BLANK_MARKERS');
    }
  });
});
