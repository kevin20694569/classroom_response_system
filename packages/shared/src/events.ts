import { z } from 'zod';
import { SessionViewSchema } from './views.js';

/** Socket.IO 事件（contracts/realtime-events.md）。Socket.IO 只負責伺服器推播。 */
export const SESSION_STATE = 'session:state';
export const SESSION_RESET = 'session:reset';

/** 連線被拒絕時 connect_error 的訊息。 */
export const UNAUTHORIZED_MESSAGE = 'UNAUTHORIZED';

export const SessionStatePayloadSchema = z.object({
  view: SessionViewSchema,
  /** 伺服器每次變更後遞增；客戶端忽略比目前更舊的版本 */
  version: z.number().int().nonnegative(),
});
export type SessionStatePayload = z.infer<typeof SessionStatePayloadSchema>;

export const SessionResetPayloadSchema = z.object({
  reason: z.literal('NEW_ACTIVITY'),
});
export type SessionResetPayload = z.infer<typeof SessionResetPayloadSchema>;

export interface ServerToClientEvents {
  'session:state': (payload: SessionStatePayload) => void;
  'session:reset': (payload: SessionResetPayload) => void;
}

/** 001 沒有客戶端送往伺服器的自訂事件。 */
export type ClientToServerEvents = Record<string, never>;
