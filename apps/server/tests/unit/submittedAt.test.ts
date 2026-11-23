import { describe, expect, it } from 'vitest';
import { formatSubmittedAt } from '../../src/domain/export/submittedAt.js';

/** 測試時區固定為 Asia/Taipei（vitest.config.ts，research R11）。 */
describe('formatSubmittedAt（002 FR-018）', () => {
  it('以本地時區輸出 YYYY/MM/DD HH:mm:ss.SSS', () => {
    expect(formatSubmittedAt('2026-11-23T02:32:15.123Z')).toBe('2026/11/23 10:32:15.123');
  });

  it('毫秒與其他欄位補零', () => {
    expect(formatSubmittedAt('2026-01-02T00:03:04.005Z')).toBe('2026/01/02 08:03:04.005');
  });

  it('跨日依本地時區計算', () => {
    expect(formatSubmittedAt('2026-11-23T17:00:00.000Z')).toBe('2026/11/24 01:00:00.000');
  });
});
