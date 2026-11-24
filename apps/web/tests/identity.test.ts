import { describe, expect, it } from 'vitest';
import {
  clearIdentity,
  getStudentIdentity,
  getToken,
  setStudentIdentity,
  setToken,
} from '../src/api/identity';

const identity = {
  role: 'student' as const,
  groupId: 2,
  activityId: '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11',
  memberId: '3f0b2c1e-1111-4222-8333-444455556666',
  nickname: 'Milo',
  expiresAt: '2026-11-24T12:00:00.000Z',
};

describe('學生身分保存（003 research R2、data-model §2）', () => {
  it('寫入後可讀回，只存在 sessionStorage', () => {
    setStudentIdentity(identity);
    expect(getStudentIdentity()).toEqual(identity);
    expect(localStorage.length).toBe(0);
  });

  it('沒有資料、內容壞掉或格式不符時回傳 null', () => {
    expect(getStudentIdentity()).toBeNull();
    sessionStorage.setItem('crs.identity', '{不是 JSON');
    expect(getStudentIdentity()).toBeNull();
    sessionStorage.setItem('crs.identity', JSON.stringify({ role: 'student', groupId: 'x' }));
    expect(getStudentIdentity()).toBeNull();
  });

  it('004 之前保存、沒有 memberId 與暱稱的學生身分視為沒有身分', () => {
    const { memberId: _memberId, nickname: _nickname, ...legacy } = identity;
    sessionStorage.setItem('crs.identity', JSON.stringify(legacy));
    expect(getStudentIdentity()).toBeNull();
  });

  it('老師身分不視為學生身分', () => {
    sessionStorage.setItem(
      'crs.identity',
      JSON.stringify({ role: 'teacher', expiresAt: '2026-11-24T12:00:00.000Z' }),
    );
    expect(getStudentIdentity()).toBeNull();
  });

  it('clearIdentity 同時清除 token 與學生身分，不動其他鍵', () => {
    setToken('token-abc');
    setStudentIdentity(identity);
    sessionStorage.setItem('other', 'keep');
    clearIdentity();
    expect(getToken()).toBeNull();
    expect(getStudentIdentity()).toBeNull();
    expect(sessionStorage.getItem('other')).toBe('keep');
  });
});
