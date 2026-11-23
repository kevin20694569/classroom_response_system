import { describe, expect, it } from 'vitest';
import type { sheets_v4 } from '@googleapis/sheets';
import { vi } from 'vitest';
import {
  a1Range,
  toSheetGrid,
  writeCellsWith,
} from '../../src/infrastructure/sheets/googleSheetsGateway.js';

describe('toSheetGrid（Sheets API 回應轉換）', () => {
  it('轉換工作表名稱、儲存格文字與合併範圍，缺值補空字串', () => {
    const grid = toSheetGrid({
      properties: { title: '學習單' },
      merges: [{ startRowIndex: 4, endRowIndex: 6, startColumnIndex: 6, endColumnIndex: 7 }],
      data: [
        {
          startRow: 0,
          startColumn: 0,
          rowData: [
            { values: [{ formattedValue: '' }, { formattedValue: '題號' }] },
            {},
            { values: [{}, { formattedValue: '1' }, { formattedValue: '題目' }] },
          ],
        },
      ],
    });
    expect(grid.sheetTitle).toBe('學習單');
    expect(grid.cells).toEqual([['', '題號'], [], ['', '1', '題目']]);
    expect(grid.merges).toEqual([{ startRow: 4, endRow: 6, startColumn: 6, endColumn: 7 }]);
  });

  it('資料區塊有起始偏移時放到正確位置', () => {
    const grid = toSheetGrid({
      properties: { title: 'S' },
      data: [{ startRow: 2, startColumn: 1, rowData: [{ values: [{ formattedValue: 'x' }] }] }],
    });
    expect(grid.cells[2]).toEqual(['', 'x']);
  });
});

describe('a1Range', () => {
  it('以單引號包住工作表名稱並跳脫單引號', () => {
    expect(a1Range('學習單', 4, 'G')).toBe("'學習單'!G5");
    expect(a1Range("Tom's", 0, 'A')).toBe("'Tom''s'!A1");
  });
});

describe('GoogleSheetsGateway 金鑰檔驗證', () => {
  it('金鑰檔不存在或格式錯誤時拋出 ServiceAccountKeyError，訊息不含路徑', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const { GoogleSheetsGateway, ServiceAccountKeyError } =
      await import('../../src/infrastructure/sheets/googleSheetsGateway.js');
    const dir = await mkdtemp(path.join(tmpdir(), 'crs-key-'));
    const bad = path.join(dir, 'bad.json');
    await writeFile(bad, JSON.stringify({ type: 'service_account' }), 'utf8');
    try {
      for (const file of [path.join(dir, 'missing.json'), bad]) {
        try {
          new GoogleSheetsGateway(file);
          expect.unreachable();
        } catch (error) {
          expect(error).toBeInstanceOf(ServiceAccountKeyError);
          expect((error as Error).message).not.toContain(dir);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('writeCellsWith（002 research R8：單一 batchUpdate）', () => {
  function fakeClient(options: { failBatch?: boolean } = {}) {
    const get = vi.fn(() =>
      Promise.resolve({
        data: {
          sheets: [
            { properties: { sheetId: 7, title: '學習單', gridProperties: { columnCount: 7 } } },
          ],
        },
      }),
    );
    const batchUpdate = vi.fn(() =>
      options.failBatch === true
        ? Promise.reject(new Error('quota /secret/path'))
        : Promise.resolve({}),
    );
    const client = { spreadsheets: { get, batchUpdate } } as unknown as Pick<
      sheets_v4.Sheets,
      'spreadsheets'
    >;
    return { client, get, batchUpdate };
  }

  it('先讀取工作表屬性，再以一次 batchUpdate 寫入（必要時補欄）', async () => {
    const { client, get, batchUpdate } = fakeClient();
    await writeCellsWith(client, { spreadsheetId: 'doc' }, [
      { sheetTitle: '學習單', rowIndex: 3, columnIndex: 7, text: '搶答組別', mutedFrom: null },
      { sheetTitle: '學習單', rowIndex: 4, columnIndex: 6, text: 'CPU', mutedFrom: null },
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    const body = (
      batchUpdate.mock.calls[0] as unknown as [{ requestBody: { requests: unknown[] } }]
    )[0];
    expect(body.requestBody.requests).toHaveLength(3);
    expect(body.requestBody.requests[0]).toEqual({
      appendDimension: { sheetId: 7, dimension: 'COLUMNS', length: 1 },
    });
  });

  it('沒有寫入時不呼叫 Google', async () => {
    const { client, get, batchUpdate } = fakeClient();
    await writeCellsWith(client, { spreadsheetId: 'doc' }, []);
    expect(get).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it('Google 錯誤轉成 SHEETS_UNAVAILABLE，訊息不含原始錯誤', async () => {
    const { client } = fakeClient({ failBatch: true });
    const onError = vi.fn();
    const error: unknown = await writeCellsWith(
      client,
      { spreadsheetId: 'doc' },
      [{ sheetTitle: '學習單', rowIndex: 4, columnIndex: 6, text: 'CPU', mutedFrom: null }],
      onError,
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'SHEETS_UNAVAILABLE' });
    expect((error as Error).message).not.toContain('secret');
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'write');
  });
});
