import { describe, expect, it } from 'vitest';
import { clearIdentity, setToken } from '../src/api/identity';
import * as NicknameStore from '../src/student/nicknameStore';

describe('NicknameStore（004 FR-006、research R2）', () => {
  it('沒有保存時回傳 null；保存後可讀回，只存在 sessionStorage', () => {
    expect(NicknameStore.load()).toBeNull();
    NicknameStore.save('小明');
    expect(NicknameStore.load()).toBe('小明');
    expect(sessionStorage.getItem('crs.nickname')).toBe('小明');
    expect(localStorage.length).toBe(0);
  });

  it('內容不符合暱稱規則時視為沒有暱稱', () => {
    sessionStorage.setItem('crs.nickname', '   ');
    expect(NicknameStore.load()).toBeNull();
    sessionStorage.setItem('crs.nickname', '字'.repeat(21));
    expect(NicknameStore.load()).toBeNull();
  });

  it('保存時去除前後空白', () => {
    NicknameStore.save('  Milo ');
    expect(NicknameStore.load()).toBe('Milo');
  });

  it('清除分頁身分（離開組別、身分失效）時暱稱保留', () => {
    NicknameStore.save('Milo');
    setToken('token');
    clearIdentity();
    expect(NicknameStore.load()).toBe('Milo');
  });
});
