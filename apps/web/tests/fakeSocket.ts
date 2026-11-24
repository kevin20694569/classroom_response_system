import type { SessionView } from '@crs/shared';
import { act } from '@testing-library/react';

type Handler = (payload?: unknown) => void;

/**
 * 測試用的假即時連線（003 tasks T008）：記錄建立時的 token，
 * 由測試手動觸發伺服器事件，不建立真實的 Socket.IO 連線。
 * 使用方式：vi.mock('../src/api/socket', async () => ({ createSessionSocket: (await import('./fakeSocket')).createFakeSocket }))
 */
export class FakeSocket {
  readonly handlers = new Map<string, Handler[]>();
  closed = false;

  constructor(readonly token: string | null) {}

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  close(): this {
    this.closed = true;
    return this;
  }

  /** 觸發一個伺服器事件（包在 act 裡，讓 React 狀態更新完成）。 */
  emitServer(event: string, payload?: unknown): void {
    act(() => {
      for (const handler of this.handlers.get(event) ?? []) handler(payload);
    });
  }

  /** 前端主動呼叫 socket.connect() 的次數（003 T042：伺服器主動中斷後重新連線）。 */
  connectCalls = 0;

  /** 前端主動重新連線（對應 Socket.IO 的 socket.connect()）；只記錄次數，不觸發任何事件。 */
  connect(): this {
    this.connectCalls += 1;
    return this;
  }

  /** 模擬伺服器接受連線。 */
  serverConnect(): void {
    this.emitServer('connect');
  }

  /** 模擬連線中斷；reason 同 Socket.IO（伺服器主動中斷為 'io server disconnect'）。 */
  serverDisconnect(reason = 'transport close'): void {
    this.emitServer('disconnect', reason);
  }

  connectError(message: string): void {
    this.emitServer('connect_error', new Error(message));
  }

  /** 推送 session:state；version 預設遞增。 */
  sendState(view: SessionView, version = nextVersion()): void {
    this.emitServer('session:state', { view, version });
  }

  reset(): void {
    this.emitServer('session:reset', { reason: 'NEW_ACTIVITY' });
  }
}

let version = 0;
const nextVersion = (): number => (version += 1);

export const sockets: FakeSocket[] = [];

export function createFakeSocket(token: string | null): FakeSocket {
  const socket = new FakeSocket(token);
  sockets.push(socket);
  return socket;
}

/** 目前（最後建立、尚未關閉）的連線。 */
export function currentSocket(): FakeSocket {
  const open = sockets.filter((s) => !s.closed);
  const socket = open[open.length - 1];
  if (socket === undefined) throw new Error('沒有開啟中的連線');
  return socket;
}

export function resetSockets(): void {
  sockets.length = 0;
}
