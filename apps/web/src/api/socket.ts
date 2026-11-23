import type { ClientToServerEvents, ServerToClientEvents } from '@crs/shared';
import { io, type Socket } from 'socket.io-client';

export type SessionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** 建立即時連線；token 由呼叫端從 sessionStorage 取得（contracts/realtime-events.md）。 */
export function createSessionSocket(token: string | null): SessionSocket {
  return io({ auth: token === null ? {} : { token } });
}
