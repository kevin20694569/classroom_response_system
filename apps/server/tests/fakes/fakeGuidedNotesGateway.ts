import { DomainError } from '../../src/domain/errors.js';
import type {
  CellWrite,
  GuidedNotesGateway,
  SpreadsheetRef,
  SpreadsheetSnapshot,
} from '../../src/infrastructure/sheets/guidedNotesGateway.js';

/**
 * 測試替身：以 spreadsheetId 對應記憶體中的試算表內容，記錄每次寫入，
 * 並可設定讓下一次呼叫拋出 SHEETS_UNAVAILABLE。自動化測試不連線 Google（原則 VII）。
 */
export class FakeGuidedNotesGateway implements GuidedNotesGateway {
  private readonly docs = new Map<string, SpreadsheetSnapshot>();
  readonly writeLog: { spreadsheetId: string; writes: CellWrite[] }[] = [];
  readCount = 0;
  failNext = false;

  set(spreadsheetId: string, snapshot: SpreadsheetSnapshot): void {
    this.docs.set(spreadsheetId, structuredClone(snapshot));
  }

  get(spreadsheetId: string): SpreadsheetSnapshot | undefined {
    const doc = this.docs.get(spreadsheetId);
    return doc === undefined ? undefined : structuredClone(doc);
  }

  private takeFailure(): DomainError | null {
    if (!this.failNext) return null;
    this.failNext = false;
    return new DomainError('SHEETS_UNAVAILABLE', '無法存取文件（模擬）。');
  }

  read(ref: SpreadsheetRef): Promise<SpreadsheetSnapshot> {
    this.readCount += 1;
    const failure = this.takeFailure();
    if (failure !== null) return Promise.reject(failure);
    const doc = this.docs.get(ref.spreadsheetId);
    if (doc === undefined) {
      return Promise.reject(
        new DomainError(
          'SHEETS_UNAVAILABLE',
          '無法存取這份文件，請確認網址正確，且文件已分享給系統的服務帳號（編輯者）。',
        ),
      );
    }
    return Promise.resolve(structuredClone(doc));
  }

  writeCells(ref: SpreadsheetRef, writes: CellWrite[]): Promise<void> {
    const failure = this.takeFailure();
    if (failure !== null) return Promise.reject(failure);
    const doc = this.docs.get(ref.spreadsheetId);
    if (doc === undefined) {
      return Promise.reject(new DomainError('SHEETS_UNAVAILABLE', '無法存取這份文件。'));
    }
    for (const write of writes) {
      const sheet = doc.sheets.find((s) => s.sheetTitle === write.sheetTitle);
      if (sheet === undefined) {
        return Promise.reject(new DomainError('SHEETS_UNAVAILABLE', '找不到工作表。'));
      }
      while (sheet.cells.length <= write.rowIndex) sheet.cells.push([]);
      const row = sheet.cells[write.rowIndex] ?? [];
      while (row.length <= write.columnIndex) row.push('');
      row[write.columnIndex] = write.value;
      sheet.cells[write.rowIndex] = row;
    }
    this.writeLog.push({ spreadsheetId: ref.spreadsheetId, writes: structuredClone(writes) });
    return Promise.resolve();
  }
}
