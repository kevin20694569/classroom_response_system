import { readFileSync } from 'node:fs';
import { sheets as createSheetsClient, type sheets_v4 } from '@googleapis/sheets';
import { JWT } from 'google-auth-library';
import { z } from 'zod';
import { DomainError } from '../../domain/errors.js';
import { buildBatchUpdateRequests, type SheetProperties } from './batchRequests.js';
import type {
  CellWrite,
  GuidedNotesGateway,
  SheetGrid,
  SpreadsheetRef,
  SpreadsheetSnapshot,
} from './guidedNotesGateway.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/** 只取需要的欄位：工作表名稱、合併範圍、每格顯示的文字（research R7）。 */
const READ_FIELDS =
  'sheets(properties(sheetId,title),merges,data(startRow,startColumn,rowData(values(formattedValue))))';

/** 服務帳號金鑰檔只需要這兩個欄位；其餘內容不讀取、不記錄。 */
const ServiceAccountKeySchema = z.object({
  client_email: z.email(),
  private_key: z.string().min(1),
});

export class ServiceAccountKeyError extends Error {
  constructor() {
    super(
      'GOOGLE_SERVICE_ACCOUNT_KEY_FILE：金鑰檔不是有效的服務帳號 JSON 金鑰，請重新下載（詳見 quickstart.md）',
    );
    this.name = 'ServiceAccountKeyError';
  }
}

/** 讀取服務帳號金鑰並建立 JWT 憑證；錯誤訊息不包含金鑰內容或路徑。 */
function createServiceAccountAuth(keyFile: string): JWT {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(keyFile, 'utf8'));
  } catch {
    throw new ServiceAccountKeyError();
  }
  const key = ServiceAccountKeySchema.safeParse(parsed);
  if (!key.success) throw new ServiceAccountKeyError();
  return new JWT({ email: key.data.client_email, key: key.data.private_key, scopes: SCOPES });
}

const UNAVAILABLE_MESSAGE =
  '無法存取這份文件，請確認網址正確，且文件已分享給系統的服務帳號（編輯者）。';

/** 外部輸入一律在執行期驗證（constitution 原則 V）。 */
const SnapshotSchema = z.object({
  sheets: z.array(
    z.object({
      sheetTitle: z.string(),
      cells: z.array(z.array(z.string())),
      merges: z.array(
        z.object({
          startRow: z.number().int().nonnegative(),
          endRow: z.number().int().nonnegative(),
          startColumn: z.number().int().nonnegative(),
          endColumn: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
});

/** 把 Sheets API 回傳的工作表轉成 SheetGrid（缺值補空字串）。 */
export function toSheetGrid(sheet: sheets_v4.Schema$Sheet): SheetGrid {
  const cells: string[][] = [];
  for (const block of sheet.data ?? []) {
    const startRow = block.startRow ?? 0;
    const startColumn = block.startColumn ?? 0;
    (block.rowData ?? []).forEach((rowData, r) => {
      const rowIndex = startRow + r;
      while (cells.length <= rowIndex) cells.push([]);
      const row = cells[rowIndex] ?? [];
      (rowData.values ?? []).forEach((cell, c) => {
        const columnIndex = startColumn + c;
        while (row.length <= columnIndex) row.push('');
        row[columnIndex] = cell.formattedValue ?? '';
      });
      cells[rowIndex] = row;
    });
  }
  return {
    sheetTitle: sheet.properties?.title ?? '',
    cells,
    merges: (sheet.merges ?? []).map((m) => ({
      startRow: m.startRowIndex ?? 0,
      endRow: m.endRowIndex ?? 0,
      startColumn: m.startColumnIndex ?? 0,
      endColumn: m.endColumnIndex ?? 0,
    })),
  };
}

/** A1 表示法：工作表名稱以單引號包住，名稱內的單引號重複一次以跳脫。 */
export function a1Range(sheetTitle: string, rowIndex: number, columnName: string): string {
  return `'${sheetTitle.replace(/'/g, "''")}'!${columnName}${rowIndex + 1}`;
}

/**
 * 以服務帳號直接讀寫線上 Google Sheets（FR-006，research R7）。
 * 老師需先把 Guided Notes 分享給服務帳號（編輯者）。任何 Google 端錯誤都轉成
 * SHEETS_UNAVAILABLE，回應不含金鑰路徑或原始錯誤內容。
 */
export class GoogleSheetsGateway implements GuidedNotesGateway {
  private readonly client: sheets_v4.Sheets;

  constructor(
    keyFile: string,
    private readonly onError: (error: unknown, operation: string) => void = () => undefined,
  ) {
    this.client = createSheetsClient({ version: 'v4', auth: createServiceAccountAuth(keyFile) });
  }

  async read(ref: SpreadsheetRef): Promise<SpreadsheetSnapshot> {
    let data: sheets_v4.Schema$Spreadsheet;
    try {
      const response = await this.client.spreadsheets.get({
        spreadsheetId: ref.spreadsheetId,
        includeGridData: true,
        fields: READ_FIELDS,
      });
      data = response.data;
    } catch (error) {
      this.onError(error, 'read');
      throw new DomainError('SHEETS_UNAVAILABLE', UNAVAILABLE_MESSAGE);
    }
    const parsed = SnapshotSchema.safeParse({ sheets: (data.sheets ?? []).map(toSheetGrid) });
    if (!parsed.success) {
      throw new DomainError('SHEETS_UNAVAILABLE', '讀取到的文件內容格式無法辨識，請稍後再試。');
    }
    return parsed.data;
  }

  /** 以單一 spreadsheets.batchUpdate 寫入（002 research R8），細節見 writeCellsWith。 */
  async writeCells(ref: SpreadsheetRef, writes: CellWrite[]): Promise<void> {
    await writeCellsWith(this.client, ref, writes, this.onError);
  }
}

const WRITE_FAILED_MESSAGE =
  '寫入文件失敗，請確認文件已分享給系統的服務帳號（編輯者）後再匯出一次。';

/** 寫入時需要的工作表屬性（工作表 ID 與目前欄數）。 */
const PROPERTIES_FIELDS = 'sheets.properties(sheetId,title,gridProperties.columnCount)';

/**
 * 先讀取工作表屬性，再以**單一** spreadsheets.batchUpdate 寫入所有儲存格（必要時先補足欄數）。
 * batchUpdate 任一請求失敗時整批都不套用，因此不會只寫了一半（002 FR-022）。
 * Google 端的任何錯誤都轉成 SHEETS_UNAVAILABLE，回應不含原始錯誤或金鑰路徑。
 */
export async function writeCellsWith(
  client: Pick<sheets_v4.Sheets, 'spreadsheets'>,
  ref: SpreadsheetRef,
  writes: readonly CellWrite[],
  onError: (error: unknown, operation: string) => void = () => undefined,
): Promise<void> {
  if (writes.length === 0) return;
  let properties: SheetProperties[];
  try {
    const response = await client.spreadsheets.get({
      spreadsheetId: ref.spreadsheetId,
      fields: PROPERTIES_FIELDS,
    });
    properties = (response.data.sheets ?? []).map((sheet) => ({
      sheetId: sheet.properties?.sheetId ?? 0,
      title: sheet.properties?.title ?? '',
      columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
    }));
  } catch (error) {
    onError(error, 'write');
    throw new DomainError('SHEETS_UNAVAILABLE', WRITE_FAILED_MESSAGE);
  }
  const requests = buildBatchUpdateRequests(properties, writes);
  try {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: ref.spreadsheetId,
      requestBody: { requests },
    });
  } catch (error) {
    onError(error, 'write');
    throw new DomainError('SHEETS_UNAVAILABLE', WRITE_FAILED_MESSAGE);
  }
}
