import { describe, expect, it } from 'vitest';
import { buildBatchUpdateRequests } from '../../src/infrastructure/sheets/batchRequests.js';
import type { CellWrite } from '../../src/infrastructure/sheets/guidedNotesGateway.js';

const sheets = [{ sheetId: 42, title: '學習單', columnCount: 7 }];
const write = (overrides: Partial<CellWrite> = {}): CellWrite => ({
  sheetTitle: '學習單',
  rowIndex: 4,
  columnIndex: 6,
  text: 'CPU',
  mutedFrom: null,
  ...overrides,
});

describe('buildBatchUpdateRequests（002 research R8）', () => {
  it('欄數足夠時沒有 appendDimension；每格一個 updateCells', () => {
    const requests = buildBatchUpdateRequests(sheets, [write(), write({ rowIndex: 5, text: '0' })]);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual({
      updateCells: {
        start: { sheetId: 42, rowIndex: 4, columnIndex: 6 },
        rows: [{ values: [{ userEnteredValue: { stringValue: 'CPU' }, textFormatRuns: [] }] }],
        fields: 'userEnteredValue,textFormatRuns',
      },
    });
  });

  it('寫入超出欄數時先補足欄數', () => {
    const requests = buildBatchUpdateRequests(sheets, [
      write({ rowIndex: 3, columnIndex: 7, text: '搶答組別' }),
      write({ rowIndex: 3, columnIndex: 8, text: '提交時間' }),
    ]);
    expect(requests[0]).toEqual({
      appendDimension: { sheetId: 42, dimension: 'COLUMNS', length: 2 },
    });
    expect(requests).toHaveLength(3);
  });

  it('空字串清空儲存格（沒有 userEnteredValue）', () => {
    const [request] = buildBatchUpdateRequests(sheets, [write({ text: '' })]);
    expect(request?.updateCells?.rows?.[0]?.values?.[0]).toEqual({ textFormatRuns: [] });
  });

  it('有淡化區段時分成兩段文字樣式', () => {
    const text = '0\n〔第 1 組｜2026/11/23 10:32:15.123〕';
    const [request] = buildBatchUpdateRequests(sheets, [write({ text, mutedFrom: 1 })]);
    const runs = request?.updateCells?.rows?.[0]?.values?.[0]?.textFormatRuns;
    expect(runs?.[0]).toEqual({ startIndex: 0, format: {} });
    expect(runs?.[1]?.startIndex).toBe(1);
    expect(runs?.[1]?.format?.fontSize).toBe(8);
    expect(runs?.[1]?.format?.foregroundColorStyle?.rgbColor).toBeDefined();
  });

  it('以「=」開頭的答案仍以文字寫入', () => {
    const [request] = buildBatchUpdateRequests(sheets, [write({ text: '=1+1' })]);
    expect(request?.updateCells?.rows?.[0]?.values?.[0]?.userEnteredValue).toEqual({
      stringValue: '=1+1',
    });
  });

  it('找不到工作表時拋出 SHEETS_UNAVAILABLE', () => {
    expect(() => buildBatchUpdateRequests(sheets, [write({ sheetTitle: '其他' })])).toThrow(
      expect.objectContaining({ code: 'SHEETS_UNAVAILABLE' }),
    );
  });
});
