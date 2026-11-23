import { describe, expect, it } from 'vitest';
import { formatClock, formatElapsed } from '../src/utils/timeFormat';

describe('formatElapsed（002 FR-009）', () => {
  it('分:秒.百分秒', () => {
    expect(formatElapsed(0)).toBe('00:00.00');
    expect(formatElapsed(187_420)).toBe('03:07.42');
  });

  it('無條件捨去到百分秒', () => {
    expect(formatElapsed(999)).toBe('00:00.99');
    expect(formatElapsed(59_999)).toBe('00:59.99');
  });

  it('滿 1 小時改為 時:分:秒.百分秒', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00.00');
    expect(formatElapsed(3_723_450)).toBe('1:02:03.45');
  });

  it('負數視為 0', () => {
    expect(formatElapsed(-5000)).toBe('00:00.00');
  });
});

describe('formatClock（002 FR-015）', () => {
  it('本地時區 HH:mm:ss.SSS（測試時區為 Asia/Taipei）', () => {
    expect(formatClock('2026-11-23T02:32:15.005Z')).toBe('10:32:15.005');
  });
});
