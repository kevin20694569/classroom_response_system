/**
 * Guided Notes 存取介面（擴充點與測試替身的接縫，constitution 原則 IV、VII）。
 * 正式環境使用 GoogleSheetsGateway 直接讀寫線上 Google Sheets（FR-006）；
 * 自動化測試使用 FakeGuidedNotesGateway，不連線 Google。
 */

/** 合併儲存格範圍（0 起算，end 為不含）。 */
export interface MergeRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

/** 一個工作表的內容：每格顯示的文字（空格為 ""）與合併範圍。 */
export interface SheetGrid {
  sheetTitle: string;
  cells: string[][];
  merges: MergeRange[];
}

export interface SpreadsheetSnapshot {
  sheets: SheetGrid[];
}

export interface SpreadsheetRef {
  spreadsheetId: string;
}

/** 要寫入的單一儲存格（0 起算）。 */
export interface CellWrite {
  sheetTitle: string;
  rowIndex: number;
  columnIndex: number;
  value: string;
}

export interface GuidedNotesGateway {
  read(ref: SpreadsheetRef): Promise<SpreadsheetSnapshot>;
  writeCells(ref: SpreadsheetRef, writes: CellWrite[]): Promise<void>;
}
