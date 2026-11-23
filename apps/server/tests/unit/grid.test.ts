import { describe, expect, it } from 'vitest';
import {
  anchorOf,
  columnName,
  effectiveValue,
  rawValue,
} from '../../src/domain/guidedNotes/grid.js';
import type { SheetGrid } from '../../src/infrastructure/sheets/guidedNotesGateway.js';

const grid: SheetGrid = {
  sheetTitle: '學習單',
  cells: [
    ['', '1', '題目', '', ''],
    ['', '', '', '', ''],
  ],
  merges: [{ startRow: 0, endRow: 2, startColumn: 1, endColumn: 2 }],
};

describe('grid', () => {
  it('合併範圍內任一格取左上角的值與位置', () => {
    expect(rawValue(grid, 1, 1)).toBe('');
    expect(effectiveValue(grid, 1, 1)).toBe('1');
    expect(anchorOf(grid, 1, 1)).toEqual({ rowIndex: 0, columnIndex: 1 });
  });

  it('沒有合併時位置就是自己；超出範圍的格為空字串', () => {
    expect(anchorOf(grid, 1, 3)).toEqual({ rowIndex: 1, columnIndex: 3 });
    expect(effectiveValue(grid, 9, 9)).toBe('');
  });

  it.each([
    [0, 'A'],
    [6, 'G'],
    [25, 'Z'],
    [26, 'AA'],
    [51, 'AZ'],
    [52, 'BA'],
  ])('欄號 %i → %s', (index, name) => {
    expect(columnName(index)).toBe(name);
  });
});
