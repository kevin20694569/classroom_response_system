import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStudentIdentity, getToken, setStudentIdentity, setToken } from '../src/api/identity';
import { INVALIDATION_NOTICE, useStudentAuth } from '../src/hooks/useStudentAuth';
import { mockFetch } from './helpers';

const ACTIVITY = '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11';
const identity = (expiresAt: string) => ({
  role: 'student' as const,
  groupId: 2,
  activityId: ACTIVITY,
  memberId: '3f0b2c1e-1111-4222-8333-444455556666',
  nickname: 'Milo',
  expiresAt,
});
const FUTURE = '2999-01-01T00:00:00.000Z';

afterEach(() => {
  vi.useRealTimers();
});

describe('useStudentAuth（003 US1、research R2、R4）', () => {
  it('join 成功後保存 token 與學生身分', async () => {
    const { calls } = mockFetch([
      { status: 200, body: { token: 'token-2', identity: identity(FUTURE) } },
    ]);
    const { result } = renderHook(() => useStudentAuth());
    await act(() => result.current.join(2));
    expect(calls[0]?.url).toBe('/api/auth/student');
    expect(result.current.token).toBe('token-2');
    expect(result.current.identity?.groupId).toBe(2);
    expect(getToken()).toBe('token-2');
    expect(getStudentIdentity()?.activityId).toBe(ACTIVITY);
  });

  it.each(['NO_ACTIVE_ACTIVITY', 'INVALID_GROUP'] as const)(
    '%s 時拋出伺服器訊息且不保存',
    async (code) => {
      mockFetch([{ status: 400, body: { error: { code, message: `伺服器說：${code}` } } }]);
      const { result } = renderHook(() => useStudentAuth());
      await expect(act(() => result.current.join(9))).rejects.toThrow(`伺服器說：${code}`);
      expect(result.current.token).toBeNull();
      expect(getToken()).toBeNull();
    },
  );

  it('leave 清除身分與所有草稿，不顯示失效訊息', () => {
    setToken('token-2');
    setStudentIdentity(identity(FUTURE));
    sessionStorage.setItem(`crs.draft.${ACTIVITY}.2.1`, '["草稿"]');
    sessionStorage.setItem('other', 'keep');
    const { result } = renderHook(() => useStudentAuth());
    expect(result.current.identity?.groupId).toBe(2);
    act(() => {
      result.current.leave();
    });
    expect(result.current.token).toBeNull();
    expect(result.current.identity).toBeNull();
    expect(result.current.notice).toBeNull();
    expect(sessionStorage.getItem(`crs.draft.${ACTIVITY}.2.1`)).toBeNull();
    expect(sessionStorage.getItem('other')).toBe('keep');
  });

  it.each(['NEW_ACTIVITY', 'EXPIRED'] as const)(
    'onInvalidated(%s) 清除身分並記下原因',
    (reason) => {
      setToken('token-2');
      setStudentIdentity(identity(FUTURE));
      sessionStorage.setItem(`crs.draft.${ACTIVITY}.2.3`, '["草稿"]');
      const { result } = renderHook(() => useStudentAuth());
      act(() => {
        result.current.onInvalidated(reason);
      });
      expect(result.current.token).toBeNull();
      expect(result.current.notice).toBe(INVALIDATION_NOTICE[reason]);
      expect(sessionStorage.getItem(`crs.draft.${ACTIVITY}.2.3`)).toBeNull();
    },
  );

  it('失效訊息文字（research R4）', () => {
    expect(INVALIDATION_NOTICE.NEW_ACTIVITY).toBe('老師已開始新的活動，請重新選擇組別。');
    expect(INVALIDATION_NOTICE.EXPIRED).toBe('這個分頁的組別身分已失效，請重新選擇組別。');
  });

  it('重新建立 hook（重新整理）時從 sessionStorage 讀回身分', () => {
    setToken('token-2');
    setStudentIdentity(identity(FUTURE));
    const { result } = renderHook(() => useStudentAuth());
    expect(result.current.token).toBe('token-2');
    expect(result.current.identity?.groupId).toBe(2);
  });

  it('到達 expiresAt 時自動視為 EXPIRED', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T00:00:00.000Z'));
    setToken('token-2');
    setStudentIdentity(identity('2026-11-24T00:00:10.000Z'));
    const { result } = renderHook(() => useStudentAuth());
    expect(result.current.identity).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.identity).toBeNull();
    expect(result.current.notice).toBe(INVALIDATION_NOTICE.EXPIRED);
    expect(getToken()).toBeNull();
  });

  it('到期時間很遠（超過 setTimeout 上限）時不會提早失效', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T00:00:00.000Z'));
    setToken('token-2');
    setStudentIdentity(identity('2026-12-31T00:00:00.000Z'));
    const { result } = renderHook(() => useStudentAuth());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.identity).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(37 * 24 * 60 * 60 * 1000);
    });
    expect(result.current.identity).toBeNull();
    expect(result.current.notice).toBe(INVALIDATION_NOTICE.EXPIRED);
  });

  it('讀回的身分已過期時直接視為失效', () => {
    setToken('token-2');
    setStudentIdentity(identity('2000-01-01T00:00:00.000Z'));
    const { result } = renderHook(() => useStudentAuth());
    expect(result.current.identity).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.notice).toBe(INVALIDATION_NOTICE.EXPIRED);
  });

  it('只有老師 token、沒有學生身分時保留 token（老師分頁打開學生端，research R3）', () => {
    setToken('teacher-token');
    const { result } = renderHook(() => useStudentAuth());
    expect(result.current.token).toBe('teacher-token');
    expect(result.current.identity).toBeNull();
  });
});
