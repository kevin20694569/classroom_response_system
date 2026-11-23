import { SessionStatePayloadSchema, UNAUTHORIZED_MESSAGE, type SessionView } from '@crs/shared';
import { useEffect, useRef, useState } from 'react';
import { createSessionSocket } from '../api/socket';

export interface SessionState {
  view: SessionView | null;
  connected: boolean;
}

/**
 * 訂閱伺服器推播的活動狀態：保存最新 view，忽略比目前更舊的 version；
 * 收到 UNAUTHORIZED 或 session:reset 時通知呼叫端（清除 token 並回到登入／加入畫面）。
 */
export function useSessionState(token: string | null, onUnauthorized: () => void): SessionState {
  const [state, setState] = useState<SessionState>({ view: null, connected: false });
  const versionRef = useRef(-1);
  const onUnauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    versionRef.current = -1;
    const socket = createSessionSocket(token);
    socket.on('connect', () => {
      setState((s) => ({ ...s, connected: true }));
    });
    socket.on('disconnect', () => {
      setState((s) => ({ ...s, connected: false }));
    });
    socket.on('connect_error', (error) => {
      if (error.message === UNAUTHORIZED_MESSAGE) onUnauthorizedRef.current();
    });
    socket.on('session:reset', () => {
      onUnauthorizedRef.current();
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
      socket.close();
    };
  }, [token]);

  return state;
}
