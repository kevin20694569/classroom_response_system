import { AuthResponseSchema } from '@crs/shared';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/http';
import {
  clearIdentity,
  getStudentIdentity,
  getToken,
  setStudentIdentity,
  setToken,
  type StudentIdentity,
} from '../api/identity';
import * as AnswerDraftStore from '../student/answerDraftStore';
import type { InvalidationReason } from './useSessionState';

/** 身分失效時顯示的原因（003 research R4）。 */
export const INVALIDATION_NOTICE: Readonly<Record<InvalidationReason, string>> = {
  NEW_ACTIVITY: '老師已開始新的活動，請重新選擇組別。',
  EXPIRED: '這個分頁的組別身分已失效，請重新選擇組別。',
};

export interface StudentAuth {
  /** 學生身分；老師分頁或尚未加入時為 null */
  identity: StudentIdentity | null;
  /** 本分頁的 token（可能是老師 token，research R3） */
  token: string | null;
  /** 身分失效的說明；加入成功或離開組別後清空 */
  notice: string | null;
  join: (groupId: number) => Promise<void>;
  leave: () => void;
  onInvalidated: (reason: InvalidationReason) => void;
}

interface AuthState {
  identity: StudentIdentity | null;
  token: string | null;
  notice: string | null;
}

const isExpired = (identity: StudentIdentity, now = Date.now()): boolean =>
  Date.parse(identity.expiresAt) <= now;

/** 讀取分頁身分；學生身分已過期時直接視為失效（重新整理時逾時的情況）。 */
function initialState(): AuthState {
  const identity = getStudentIdentity();
  if (identity !== null && isExpired(identity)) {
    clearIdentity();
    AnswerDraftStore.clearAll();
    return { identity: null, token: null, notice: INVALIDATION_NOTICE.EXPIRED };
  }
  return { identity, token: getToken(), notice: null };
}

/**
 * 學生身分（003 US1）：加入組別、離開組別（只在待開始由畫面提供）、身分失效。
 * 身分只存在本分頁的 sessionStorage（FR-003）；離開或失效時一併清除草稿（FR-020）。
 */
export function useStudentAuth(): StudentAuth {
  const [state, setState] = useState<AuthState>(initialState);

  const onInvalidated = useCallback((reason: InvalidationReason) => {
    clearIdentity();
    AnswerDraftStore.clearAll();
    setState({ identity: null, token: null, notice: INVALIDATION_NOTICE[reason] });
  }, []);

  const join = useCallback(async (groupId: number) => {
    const result = await apiRequest('/api/auth/student', AuthResponseSchema, {
      method: 'POST',
      body: { groupId },
    });
    if (result.identity.role !== 'student') throw new Error('伺服器回傳的身分不正確。');
    setToken(result.token);
    setStudentIdentity(result.identity);
    setState({ identity: result.identity, token: result.token, notice: null });
  }, []);

  const leave = useCallback(() => {
    clearIdentity();
    AnswerDraftStore.clearAll();
    setState({ identity: null, token: null, notice: null });
  }, []);

  // 分頁一直連著時伺服器不會主動通知逾時，依 expiresAt 在畫面上提示；
  // 送出時伺服器仍以 401 做最終判定（research R4）。
  const { identity } = state;
  useEffect(() => {
    if (identity === null) return;
    const timer = setTimeout(
      () => {
        onInvalidated('EXPIRED');
      },
      Math.max(0, Date.parse(identity.expiresAt) - Date.now()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [identity, onInvalidated]);

  return { ...state, join, leave, onInvalidated };
}
