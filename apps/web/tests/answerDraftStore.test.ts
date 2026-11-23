import { describe, expect, it } from 'vitest';
import * as AnswerDraftStore from '../src/student/answerDraftStore';

const A = 'activity-a';
const B = 'activity-b';

describe('AnswerDraftStore（003 FR-020、research R6）', () => {
  it('依活動、組別、題號保存與讀回', () => {
    AnswerDraftStore.save(A, 2, 1, ['甲', '乙']);
    expect(sessionStorage.getItem(`crs.draft.${A}.2.1`)).toBe('["甲","乙"]');
    expect(AnswerDraftStore.load(A, 2, 1, 2)).toEqual(['甲', '乙']);
    expect(localStorage.length).toBe(0);
  });

  it('沒有資料或內容壞掉時回傳空字串陣列，長度等於子題數', () => {
    expect(AnswerDraftStore.load(A, 2, 1, 2)).toEqual(['', '']);
    sessionStorage.setItem(`crs.draft.${A}.2.3`, '{壞掉');
    expect(AnswerDraftStore.load(A, 2, 3, 1)).toEqual(['']);
    sessionStorage.setItem(`crs.draft.${A}.2.4`, '[1, 2]');
    expect(AnswerDraftStore.load(A, 2, 4, 1)).toEqual(['']);
  });

  it('長度不足時補空字串、過長時截斷', () => {
    AnswerDraftStore.save(A, 2, 1, ['甲']);
    expect(AnswerDraftStore.load(A, 2, 1, 2)).toEqual(['甲', '']);
    AnswerDraftStore.save(A, 2, 1, ['甲', '乙', '丙']);
    expect(AnswerDraftStore.load(A, 2, 1, 2)).toEqual(['甲', '乙']);
  });

  it('不同活動或組別互不影響；clear 只清該題', () => {
    AnswerDraftStore.save(A, 2, 1, ['甲']);
    AnswerDraftStore.save(A, 2, 3, ['丙']);
    AnswerDraftStore.save(B, 2, 1, ['新活動']);
    AnswerDraftStore.save(A, 1, 1, ['第一組']);
    AnswerDraftStore.clear(A, 2, 1);
    expect(AnswerDraftStore.load(A, 2, 1, 1)).toEqual(['']);
    expect(AnswerDraftStore.load(A, 2, 3, 1)).toEqual(['丙']);
    expect(AnswerDraftStore.load(B, 2, 1, 1)).toEqual(['新活動']);
    expect(AnswerDraftStore.load(A, 1, 1, 1)).toEqual(['第一組']);
  });

  it('clearAll 清除所有草稿，不動 token', () => {
    sessionStorage.setItem('crs.token', 'token');
    AnswerDraftStore.save(A, 2, 1, ['甲']);
    AnswerDraftStore.save(B, 1, 2, ['乙']);
    AnswerDraftStore.clearAll();
    expect(AnswerDraftStore.load(A, 2, 1, 1)).toEqual(['']);
    expect(AnswerDraftStore.load(B, 1, 2, 1)).toEqual(['']);
    expect(sessionStorage.getItem('crs.token')).toBe('token');
  });

  it('hasUnsent：只有該活動與組別有非空白草稿時為 true（FR-018）', () => {
    expect(AnswerDraftStore.hasUnsent(A, 2)).toBe(false);
    AnswerDraftStore.save(A, 2, 1, ['  ', '']);
    expect(AnswerDraftStore.hasUnsent(A, 2)).toBe(false);
    AnswerDraftStore.save(A, 1, 1, ['他組']);
    expect(AnswerDraftStore.hasUnsent(A, 2)).toBe(false);
    AnswerDraftStore.save(A, 2, 3, ['有內容']);
    expect(AnswerDraftStore.hasUnsent(A, 2)).toBe(true);
    expect(AnswerDraftStore.hasUnsent(B, 2)).toBe(false);
  });
});
