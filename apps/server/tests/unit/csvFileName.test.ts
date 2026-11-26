import { describe, expect, it } from 'vitest';
import { csvAsciiFileName, csvFileName } from '../../src/domain/export/csv/csvFileName.js';

describe('csvFileName（FR-010，時區 Asia/Taipei）', () => {
  it('以開啟搶答的本地時間命名', () => {
    expect(csvFileName('2026-11-26T02:32:15.123Z')).toBe('搶答結果_20261126-1032.csv');
    expect(csvAsciiFileName('2026-11-26T02:32:15.123Z')).toBe('results_20261126-1032.csv');
  });

  it('月、日、時、分補零為兩位', () => {
    expect(csvFileName('2026-01-02T00:03:00Z')).toBe('搶答結果_20260102-0803.csv');
    expect(csvAsciiFileName('2026-01-02T00:03:00Z')).toBe('results_20260102-0803.csv');
  });

  it('跨日依本地時區計算', () => {
    expect(csvFileName('2026-12-31T16:30:00Z')).toBe('搶答結果_20270101-0030.csv');
  });
});
