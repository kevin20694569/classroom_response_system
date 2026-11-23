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

/** 要寫入的單一儲存格（0 起算）。值一律以文字寫入，不會被解析成公式、數字或日期。 */
export interface CellWrite {
  sheetTitle: string;
  rowIndex: number;
  columnIndex: number;
  /** 寫入的文字；空字串表示清空這一格 */
  text: string;
  /**
   * 從這個字元位置（UTF-16 索引，與 JavaScript 字串索引相同）起以淡化樣式（較小、灰色）顯示，
   * 用於「答案＋格內附註行」模式（002 FR-020）。null 表示整格為一般樣式，並清除既有的局部文字樣式。
   */
  mutedFrom: number | null;
}

export interface GuidedNotesGateway {
  read(ref: SpreadsheetRef): Promise<SpreadsheetSnapshot>;
  writeCells(ref: SpreadsheetRef, writes: CellWrite[]): Promise<void>;
}
