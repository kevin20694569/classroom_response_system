import { describe, expect, it } from 'vitest';
import { parseGuidedNotes } from '../../src/domain/guidedNotes/parser.js';
import type { SpreadsheetSnapshot } from '../../src/infrastructure/sheets/guidedNotesGateway.js';
import { loadFixture } from '../helpers/fixtures.js';

/** 依 contracts/guided-notes-format.md §A 的預期表（002 FR-001）。 */
describe('題目敘述讀取（002 FR-001）', () => {
  it('單題範例：6 題都有題目敘述，子題敘述為 null', () => {
    const snapshot = loadFixture('single-example');
    const cells = snapshot.sheets[0]?.cells ?? [];
    const { questions } = parseGuidedNotes(snapshot);
    expect(questions).toHaveLength(6);
    // 敘述跨兩列合併，只取左上角一次
    expect(questions[0]?.prompt).toBe(cells[4]?.[2]);
    for (const q of questions) {
      expect(q.prompt).toBeTruthy();
      expect(q.prompt).not.toContain('\n');
      expect(q.blanks[0]?.prompt).toBeNull();
    }
  });

  it('題組範例：題組沒有題組說明，兩個子題各有敘述；單題有敘述', () => {
    const snapshot = loadFixture('group-example');
    const cells = snapshot.sheets[0]?.cells ?? [];
    const { questions } = parseGuidedNotes(snapshot);
    expect(questions.map((q) => q.kind)).toEqual(['group', 'group', 'single', 'single']);
    expect(questions[0]?.prompt).toBeNull();
    expect(questions[0]?.blanks.map((b) => b.prompt)).toEqual([cells[4]?.[2], cells[5]?.[2]]);
    expect(questions[1]?.blanks.map((b) => b.prompt)).toEqual([cells[7]?.[2], cells[8]?.[2]]);
    expect(questions[2]?.prompt).toBe(cells[10]?.[2]);
    expect(questions[3]?.prompt).toBe(cells[12]?.[2]);
  });

  it('沒有「題目」表頭：匯入成功，所有敘述為 null，題數與位置不變', () => {
    const withHeader = parseGuidedNotes(loadFixture('single-example'));
    const parsed = parseGuidedNotes(loadFixture('no-prompt-header'));
    expect(parsed.questions.map((q) => q.prompt)).toEqual(Array(6).fill(null));
    expect(parsed.questions.map((q) => q.blanks.map((b) => b.location))).toEqual(
      withHeader.questions.map((q) => q.blanks.map((b) => b.location)),
    );
  });

  it('題組說明：跨所有子題列合併的敘述成為題組說明，子題沒有自己的敘述時為 null', () => {
    const snapshot: SpreadsheetSnapshot = {
      sheets: [
        {
          sheetTitle: '學習單',
          cells: [
            ['題號', '題目', '作答'],
            ['1', '閱讀下列短文後作答', '（1）'],
            ['1', '', '（2）'],
          ],
          merges: [{ startRow: 1, endRow: 3, startColumn: 1, endColumn: 2 }],
        },
      ],
    };
    const [question] = parseGuidedNotes(snapshot).questions;
    expect(question?.kind).toBe('group');
    expect(question?.prompt).toBe('閱讀下列短文後作答');
    expect(question?.blanks.map((b) => b.prompt)).toEqual([null, null]);
  });

  it('單題的多列敘述去除重複後以換行合併，保留原有換行', () => {
    const snapshot: SpreadsheetSnapshot = {
      sheets: [
        {
          sheetTitle: '學習單',
          cells: [
            ['題號', '題目', '作答'],
            ['1', '  第一行\n第二行  ', ''],
            ['1', '補充說明', ''],
          ],
          merges: [{ startRow: 1, endRow: 3, startColumn: 2, endColumn: 3 }],
        },
      ],
    };
    const [question] = parseGuidedNotes(snapshot).questions;
    expect(question?.kind).toBe('single');
    expect(question?.prompt).toBe('第一行\n第二行\n補充說明');
  });
});
