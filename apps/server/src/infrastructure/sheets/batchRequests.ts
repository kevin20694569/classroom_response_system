import type { sheets_v4 } from '@googleapis/sheets';
import { DomainError } from '../../domain/errors.js';
import type { CellWrite } from './guidedNotesGateway.js';

/** 寫入前讀到的工作表屬性。 */
export interface SheetProperties {
  sheetId: number;
  title: string;
  columnCount: number;
}

/** 附註行的淡化樣式：較小字級與灰色（#80868B，002 research R8）。 */
const MUTED_FORMAT: sheets_v4.Schema$TextFormat = {
  fontSize: 8,
  foregroundColorStyle: { rgbColor: { red: 0x80 / 255, green: 0x86 / 255, blue: 0x8b / 255 } },
};

function cellData(write: CellWrite): sheets_v4.Schema$CellData {
  return {
    // stringValue 一律當作文字：「=」開頭的答案不會被當成公式，時間的毫秒也不會被轉成日期而捨去
    ...(write.text === '' ? {} : { userEnteredValue: { stringValue: write.text } }),
    // 空陣列會清除既有的局部文字樣式；有淡化區段時，答案部分沿用儲存格原有格式（format 為空）
    textFormatRuns:
      write.mutedFrom === null || write.text === ''
        ? []
        : [
            { startIndex: 0, format: {} },
            { startIndex: write.mutedFrom, format: MUTED_FORMAT },
          ],
  };
}

/**
 * 把寫入清單轉成單一 spreadsheets.batchUpdate 的請求（002 research R8）：
 * 1. 任何寫入超出工作表目前欄數時，先以 appendDimension 補足欄數；
 * 2. 每個儲存格一個 updateCells，只更新文字與局部文字樣式（不動框線、底色、對齊等格式）。
 * batchUpdate 中任一請求無效時整批都不套用，因此達成全有或全無（FR-022）。
 */
export function buildBatchUpdateRequests(
  sheets: readonly SheetProperties[],
  writes: readonly CellWrite[],
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [];
  const updates: sheets_v4.Schema$Request[] = [];
  const neededColumns = new Map<number, number>();

  for (const write of writes) {
    const sheet = sheets.find((s) => s.title === write.sheetTitle);
    if (sheet === undefined) {
      throw new DomainError(
        'SHEETS_UNAVAILABLE',
        '找不到要寫入的工作表，文件可能已被修改，請重新匯入後再試。',
      );
    }
    neededColumns.set(
      sheet.sheetId,
      Math.max(neededColumns.get(sheet.sheetId) ?? 0, write.columnIndex + 1),
    );
    updates.push({
      updateCells: {
        start: { sheetId: sheet.sheetId, rowIndex: write.rowIndex, columnIndex: write.columnIndex },
        rows: [{ values: [cellData(write)] }],
        fields: 'userEnteredValue,textFormatRuns',
      },
    });
  }

  for (const sheet of sheets) {
    const needed = neededColumns.get(sheet.sheetId) ?? 0;
    if (needed > sheet.columnCount) {
      requests.push({
        appendDimension: {
          sheetId: sheet.sheetId,
          dimension: 'COLUMNS',
          length: needed - sheet.columnCount,
        },
      });
    }
  }
  return [...requests, ...updates];
}
