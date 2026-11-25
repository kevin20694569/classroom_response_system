import { SessionStatePayloadSchema, UNAUTHORIZED_MESSAGE, type SessionView } from '@crs/shared';
import { useEffect, useRef, useState } from 'react';
import { createSessionSocket } from '../api/socket';

/** 身分失效原因（003 research R4）：老師開始新的活動，或身分逾時／屬於舊活動。 */
export type InvalidationReason = 'NEW_ACTIVITY' | 'EXPIRED';

export interface SessionState {
  view: SessionView | null;
  connected: boolean;
}

/**
 * 訂閱伺服器推播的活動狀態：保存最新 view，忽略比目前更舊的 version；
 * 收到 UNAUTHORIZED 或 session:reset 時通知呼叫端並附上原因（清除 token 並回到登入／加入畫面）。
 * 伺服器主動中斷連線（伺服器關閉）時自行重新連線，伺服器重新啟動後不需重新整理即可恢復。
 */
export function useSessionState(
  token: string | null,
  onUnauthorized: (reason: InvalidationReason) => void,
): SessionState {
  const [state, setState] = useState<SessionState>({ view: null, connected: false });
  const versionRef = useRef(-1);
  const onUnauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    versionRef.current = -1;
    const socket = createSessionSocket(token);
    // 這條連線是否已不再使用：元件卸載、或活動換新（之後由新的身分建立新連線）
    let retired = false;
    socket.on('connect', () => {
      // 伺服器每次接受連線都會先送一份完整狀態；伺服器重新啟動後 version 從 0 重新計算，
      // 因此每次（重新）連線都重設版本，避免重啟後的狀態被當成舊版本而忽略（004 FR-013）
      versionRef.current = -1;
      setState((s) => ({ ...s, connected: true }));
    });
    socket.on('disconnect', (reason) => {
      setState((s) => ({ ...s, connected: false }));
      // 伺服器主動中斷（例如伺服器關閉後重新啟動）時 Socket.IO 不會自動重連，需自行重新連線（FR-010）
      if (reason === 'io server disconnect' && !retired) socket.connect();
    });
    socket.on('connect_error', (error) => {
      if (error.message === UNAUTHORIZED_MESSAGE) onUnauthorizedRef.current('EXPIRED');
    });
    socket.on('session:reset', () => {
      retired = true;
      onUnauthorizedRef.current('NEW_ACTIVITY');
    });
    socket.on('session:state', (payload) => {
      const parsed = SessionStatePayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      // 重連或延遲時可能收到舊版本，以伺服器的 version 為準
      if (parsed.data.version < versionRef.current) return;
      versionRef.current = parsed.data.version;
      setState({ view: parsed.data.view, connected: true });
    });
    return () => {
      retired = true;
      socket.close();
    };
  }, [token]);

  return state;
}
