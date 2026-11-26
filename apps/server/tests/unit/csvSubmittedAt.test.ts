import { describe, expect, it } from 'vitest';
import { formatCsvSubmittedAt } from '../../src/domain/export/csv/csvSubmittedAt.js';

/** 測試時區固定為 Asia/Taipei（vitest.config.ts，research R11）。 */
describe('formatCsvSubmittedAt（Excel 可完整顯示的日期時間）', () => {
  it('以本地時區輸出 YYYY-MM-DD HH:mm:ss，不含毫秒', () => {
    expect(formatCsvSubmittedAt('2026-11-26T05:11:00.500Z')).toBe('2026-11-26 13:11:00');
  });

  it('月、日、時、分、秒補零', () => {
    expect(formatCsvSubmittedAt('2026-01-02T00:03:04.005Z')).toBe('2026-01-02 08:03:04');
  });

  it('跨日依本地時區計算', () => {
    expect(formatCsvSubmittedAt('2026-11-23T17:00:00.000Z')).toBe('2026-11-24 01:00:00');
  });
});
