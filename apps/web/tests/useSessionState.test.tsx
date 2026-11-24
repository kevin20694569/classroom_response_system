import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionState } from '../src/hooks/useSessionState';
import { currentSocket, resetSockets, sockets } from './fakeSocket';
import { studentView } from './viewBuilders';

vi.mock('../src/api/socket', async () => ({
  createSessionSocket: (await import('./fakeSocket')).createFakeSocket,
}));

beforeEach(() => {
  resetSockets();
});

describe('useSessionState 斷線重連（003 FR-010、US1 情境 4）', () => {
  it('伺服器主動中斷（例如伺服器重新啟動）時顯示斷線並自行重新連線', () => {
    const onUnauthorized = vi.fn();
    const { result } = renderHook(() => useSessionState('token-2', onUnauthorized));
    const socket = currentSocket();
    socket.serverConnect();
    socket.sendState(studentView());
    expect(result.current.connected).toBe(true);

    socket.serverDisconnect('io server disconnect');

    expect(result.current.connected).toBe(false);
    expect(socket.connectCalls).toBe(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('一般網路中斷交給 Socket.IO 自動重連，不另外呼叫 connect', () => {
    const { result } = renderHook(() => useSessionState('token-2', vi.fn()));
    const socket = currentSocket();
    socket.serverConnect();

    socket.serverDisconnect('transport close');

    expect(result.current.connected).toBe(false);
    expect(socket.connectCalls).toBe(0);
  });

  it('收到 session:reset 後的中斷不重連，交給新的身分建立新連線', () => {
    const onUnauthorized = vi.fn();
    renderHook(() => useSessionState('token-2', onUnauthorized));
    const socket = currentSocket();
    socket.serverConnect();

    socket.reset();
    socket.serverDisconnect('io server disconnect');

    expect(onUnauthorized).toHaveBeenCalledWith('NEW_ACTIVITY');
    expect(socket.connectCalls).toBe(0);
  });

  it('元件卸載後連線已關閉，不再重連', () => {
    const { unmount } = renderHook(() => useSessionState(null, vi.fn()));
    const socket = currentSocket();
    unmount();

    socket.serverDisconnect('io server disconnect');

    expect(sockets[0]?.closed).toBe(true);
    expect(socket.connectCalls).toBe(0);
  });
});
