import type { Server as HttpServer } from 'node:http';
import {
  SESSION_RESET,
  SESSION_STATE,
  UNAUTHORIZED_MESSAGE,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@crs/shared';
import { Server, type Socket } from 'socket.io';
import type { AuthService } from '../../auth/authService.js';
import type { TabIdentity } from '../../auth/tokens.js';
import type { DomainLogger } from '../../domain/logger.js';
import type { QuizSessionService, SessionChange } from '../../domain/session/quizSessionService.js';
import {
  toPublicView,
  toStudentView,
  toTeacherView,
} from '../../domain/visibility/visibilityPolicy.js';
import { viewFor } from '../views.js';

interface SocketData {
  identity: TabIdentity | null;
}

type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const PUBLIC_ROOM = 'public';
const TEACHERS_ROOM = 'teachers';
const groupRoom = (groupId: number): string => `group:${groupId}`;

/**
 * 即時推播（contracts/realtime-events.md）：Socket.IO 只負責伺服器推播。
 * 學生只會加入自己組別的 room，因此伺服器不可能把他組資料送到該分頁（原則 I）。
 */
export class RealtimeGateway {
  readonly io: RealtimeServer;

  constructor(
    httpServer: HttpServer,
    private readonly service: QuizSessionService,
    private readonly auth: AuthService,
    private readonly logger: DomainLogger,
  ) {
    this.io = new Server(httpServer, { serveClient: false });
    this.io.use((socket, next) => {
      const raw: unknown = (socket.handshake.auth as Record<string, unknown>).token;
      if (raw === undefined || raw === null || raw === '') {
        socket.data.identity = null;
        next();
        return;
      }
      const identity =
        typeof raw === 'string'
          ? this.auth.resolve(raw, this.service.getSession().activityId)
          : null;
      if (identity === null) {
        next(new Error(UNAUTHORIZED_MESSAGE));
        return;
      }
      socket.data.identity = identity;
      next();
    });
    this.io.on('connection', (socket) => {
      this.onConnection(socket);
    });
    this.service.onChange((changes, version) => {
      this.broadcast(changes, version);
    });
  }

  private onConnection(socket: RealtimeSocket): void {
    const identity = socket.data.identity;
    if (identity === null) void socket.join(PUBLIC_ROOM);
    else if (identity.role === 'teacher') void socket.join(TEACHERS_ROOM);
    else void socket.join(groupRoom(identity.groupId));
    // 連線（含自動重連）後立即送出完整狀態，讓重新整理或斷線的分頁回到正確畫面（FR-014）
    socket.emit(SESSION_STATE, {
      view: viewFor(identity, this.service),
      version: this.service.getVersion(),
    });
  }

  private broadcast(changes: readonly SessionChange[], version: number): void {
    const session = this.service.getSession();
    const ranking = this.service.deps.ranking;
    for (const change of changes) {
      switch (change.kind) {
        case 'reset':
          // 活動換新：舊的學生身分失效，通知後中斷連線，讓它們離開舊 room
          for (const room of this.io.of('/').adapter.rooms.keys()) {
            if (!room.startsWith('group:')) continue;
            this.io.to(room).emit(SESSION_RESET, { reason: 'NEW_ACTIVITY' });
            this.io.in(room).disconnectSockets(true);
          }
          break;
        case 'state':
          this.io.to(PUBLIC_ROOM).emit(SESSION_STATE, { view: toPublicView(session), version });
          this.io.to(TEACHERS_ROOM).emit(SESSION_STATE, {
            view: toTeacherView(session, ranking, this.service.deps.now()),
            version,
          });
          for (const group of session.groups) {
            this.io
              .to(groupRoom(group.id))
              .emit(SESSION_STATE, { view: toStudentView(session, group.id, ranking), version });
          }
          break;
        case 'submission':
          // 只送給老師與送出的那一組；其他組別不會收到任何事件，避免透露作答狀況
          this.io.to(TEACHERS_ROOM).emit(SESSION_STATE, {
            view: toTeacherView(session, ranking, this.service.deps.now()),
            version,
          });
          if (change.groupId !== undefined) {
            this.io.to(groupRoom(change.groupId)).emit(SESSION_STATE, {
              view: toStudentView(session, change.groupId, ranking),
              version,
            });
          }
          break;
        case 'export':
          this.io.to(TEACHERS_ROOM).emit(SESSION_STATE, {
            view: toTeacherView(session, ranking, this.service.deps.now()),
            version,
          });
          break;
      }
    }
    this.logger.info({ changes: changes.map((c) => c.kind), version }, '已推播狀態變更');
  }

  async close(): Promise<void> {
    this.io.disconnectSockets(true);
    await new Promise<void>((resolve) => {
      void this.io.close(() => {
        resolve();
      });
    });
  }
}
