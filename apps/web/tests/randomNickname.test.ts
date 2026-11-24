import { describe, expect, it } from 'vitest';
import { randomNickname } from '../src/student/randomNickname';

describe('randomNickname（004 FR-002、FR-003、SC-002、research R1）', () => {
  it('連續產生 200 次都只含英文字母、長度 3～10 字', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(randomNickname()).toMatch(/^[A-Za-z]{3,10}$/);
    }
  });

  it('連續 20 次至少有 15 個不同的名字', () => {
    const names = new Set(Array.from({ length: 20 }, () => randomNickname()));
    expect(names.size).toBeGreaterThanOrEqual(15);
  });

  it('指定 exclude 時不回傳同一個名字（「換一個」看得出改變）', () => {
    for (let i = 0; i < 50; i += 1) {
      const current = randomNickname();
      expect(randomNickname(current)).not.toBe(current);
    }
  });
});
