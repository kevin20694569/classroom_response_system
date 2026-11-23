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
  it('一般範例：表頭列為第 4 列、使用範圍 7 欄、沒有結果欄', () => {
    for (const name of ['single-example', 'group-example']) {
      const parsed = parseGuidedNotes(loadFixture(name));
      expect(parsed.headerRowIndex).toBe(3);
      expect(parsed.usedColumnCount).toBe(7);
      expect(parsed.resultColumns).toEqual({ groupColumn: null, timeColumn: null });
    }
  });

  it('已匯出過結果欄的文件：辨識 H、I 欄，題目判斷與題組範例相同（FR-023）', () => {
    const parsed = parseGuidedNotes(loadFixture('exported-columns'));
    expect(parsed.resultColumns).toEqual({ groupColumn: 7, timeColumn: 8 });
    expect(parsed.usedColumnCount).toBe(9);
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
