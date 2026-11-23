import type { MergeRange, SheetGrid } from '../../infrastructure/sheets/guidedNotesGateway.js';

export interface CellPosition {
  rowIndex: number;
  columnIndex: number;
}

/** 原始儲存格文字（只有合併範圍左上角有值）。 */
export function rawValue(grid: SheetGrid, row: number, col: number): string {
  return grid.cells[row]?.[col] ?? '';
}

function mergeAt(grid: SheetGrid, row: number, col: number): MergeRange | undefined {
  return grid.merges.find(
    (m) => row >= m.startRow && row < m.endRow && col >= m.startColumn && col < m.endColumn,
  );
}

/**
 * 合併儲存格的位置一律以左上角為準（contracts/guided-notes-format.md §1）。
 * 例如單題範例的作答格跨兩列合併，兩列都對應到同一個作答格。
 */
export function anchorOf(grid: SheetGrid, row: number, col: number): CellPosition {
  const merge = mergeAt(grid, row, col);
  return merge === undefined
    ? { rowIndex: row, columnIndex: col }
    : { rowIndex: merge.startRow, columnIndex: merge.startColumn };
}

/** 合併範圍內任一格都視為擁有左上角那一格的值。 */
export function effectiveValue(grid: SheetGrid, row: number, col: number): string {
  const anchor = anchorOf(grid, row, col);
  return rawValue(grid, anchor.rowIndex, anchor.columnIndex);
}

/** 0 起算的欄號轉成欄名：0→A、25→Z、26→AA。 */
export function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}
