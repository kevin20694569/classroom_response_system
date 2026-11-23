import type { QuestionSummary } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { blankLabelOf, validateDraft } from '../src/student/validateDraft';

const single: QuestionSummary = { number: 3, kind: 'single', blankCount: 1, blankLabels: [null] };
const group: QuestionSummary = {
  number: 1,
  kind: 'group',
  blankCount: 2,
  blankLabels: ['（1）', '（2）'],
};
const unlabeled: QuestionSummary = {
  number: 2,
  kind: 'group',
  blankCount: 2,
  blankLabels: [null, null],
};

describe('validateDraft（003 FR-014、research R8）', () => {
  it('全部填寫時沒有問題', () => {
    expect(validateDraft(single, ['答案'])).toEqual([]);
    expect(validateDraft(group, ['甲', '乙'])).toEqual([]);
  });

  it('去除前後空白後為空時回報 EMPTY 並指出子題', () => {
    expect(validateDraft(single, ['   '])).toEqual([
      { blankIndex: 1, kind: 'EMPTY', message: '尚未填寫' },
    ]);
    expect(validateDraft(group, ['甲', ''])).toEqual([
      { blankIndex: 2, kind: 'EMPTY', message: '（2）尚未填寫' },
    ]);
  });

  it('剛好 200 字通過，201 字回報 TOO_LONG', () => {
    expect(validateDraft(single, ['字'.repeat(200)])).toEqual([]);
    expect(validateDraft(single, ['字'.repeat(201)])).toEqual([
      { blankIndex: 1, kind: 'TOO_LONG', message: '超過 200 字' },
    ]);
  });

  it('表情符號以 Unicode 字元計算（與伺服器相同）', () => {
    expect(validateDraft(single, ['😀'.repeat(200)])).toEqual([]);
    expect(validateDraft(single, ['😀'.repeat(201)])[0]?.kind).toBe('TOO_LONG');
  });

  it('前後空白不計入字數', () => {
    expect(validateDraft(single, [`  ${'字'.repeat(200)}  `])).toEqual([]);
  });

  it('缺少的子題以空白處理', () => {
    expect(validateDraft(group, ['甲'])).toEqual([
      { blankIndex: 2, kind: 'EMPTY', message: '（2）尚未填寫' },
    ]);
  });
});

describe('blankLabelOf（research R5）', () => {
  it('有標記用原文、題組無標記用（n）、單題回 null', () => {
    expect(blankLabelOf(group, 2)).toBe('（2）');
    expect(blankLabelOf(unlabeled, 1)).toBe('（1）');
    expect(blankLabelOf(single, 1)).toBeNull();
  });
});
