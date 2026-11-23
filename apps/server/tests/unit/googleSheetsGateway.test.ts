import { describe, expect, it } from 'vitest';
import { a1Range, toSheetGrid } from '../../src/infrastructure/sheets/googleSheetsGateway.js';

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
