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
import type { GroupRoster, RosterChange } from '../../domain/roster/groupRoster.js';
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
 * 004：學生連線、斷線時通知組員名冊；名冊改變時以目前的活動版本推播人數與本組成員（research R6）。
 */
export class RealtimeGateway {
  readonly io: RealtimeServer;

  constructor(
    httpServer: HttpServer,
    private readonly service: QuizSessionService,
    private readonly auth: AuthService,
    private readonly roster: GroupRoster,
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
    this.roster.onChange((change) => {
      this.onRosterChange(change);
    });
  }

  private onConnection(socket: RealtimeSocket): void {
    const identity = socket.data.identity;
    if (identity === null) void socket.join(PUBLIC_ROOM);
    else if (identity.role === 'teacher') void socket.join(TEACHERS_ROOM);
    else {
      // 先加入名冊（或取消斷線移除計時），第一份資料就包含自己（004 contracts/realtime-events.md）。
      // 加入名冊的推播送給其他分頁；這個分頁還沒進組別 room，只會收到下方那一份完整狀態。
      const { memberId } = identity;
      this.roster.connected(memberId, identity.groupId, identity.nickname);
      void socket.join(groupRoom(identity.groupId));
      socket.on('disconnect', () => {
        this.roster.disconnected(memberId);
      });
    }
    // 連線（含自動重連）後立即送出完整狀態，讓重新整理或斷線的分頁回到正確畫面（FR-014）
    socket.emit(SESSION_STATE, {
      view: viewFor(identity, this.service, this.roster),
      version: this.service.getVersion(),
    });
  }

  /**
   * 名冊改變（加入、斷線逾時移除、離開組別、清空）：人數改變所有組都要更新，
   * 推播公開檢視與每一組的學生檢視；老師端不顯示名冊，不推播。名冊不是活動狀態，版本不遞增。
   */
  private onRosterChange(change: RosterChange): void {
    if (change.kind === 'removed') {
      this.logger.info(
        { event: 'student.roster.removed', groupId: change.groupId, memberId: change.memberId },
        '學生斷線逾時，移出組別名冊',
      );
    }
    if (change.kind === 'left') {
      // 已離開的組員不應再收到本組資料：中斷它仍連著的連線（前端會改以未登入身分重連）
      for (const socket of this.io.of('/').sockets.values()) {
        const identity = socket.data.identity;
        if (identity?.role === 'student' && identity.memberId === change.memberId) {
          socket.disconnect(true);
        }
      }
    }
    const session = this.service.getSession();
    const ranking = this.service.deps.ranking;
    const version = this.service.getVersion();
    this.io
      .to(PUBLIC_ROOM)
      .emit(SESSION_STATE, { view: toPublicView(session, this.roster), version });
    for (const group of session.groups) {
      this.io.to(groupRoom(group.id)).emit(SESSION_STATE, {
        view: toStudentView(session, group.id, ranking, this.roster, this.service.deps.now()),
        version,
      });
    }
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
          // 各組人數與名冊從 0 重新計算（004 FR-015）
          this.roster.clear();
          break;
        case 'state':
          this.io
            .to(PUBLIC_ROOM)
            .emit(SESSION_STATE, { view: toPublicView(session, this.roster), version });
          this.io.to(TEACHERS_ROOM).emit(SESSION_STATE, {
            view: toTeacherView(session, ranking, this.service.deps.now()),
            version,
          });
          for (const group of session.groups) {
            this.io.to(groupRoom(group.id)).emit(SESSION_STATE, {
              view: toStudentView(session, group.id, ranking, this.roster, this.service.deps.now()),
              version,
            });
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
              view: toStudentView(
                session,
                change.groupId,
                ranking,
                this.roster,
                this.service.deps.now(),
              ),
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
