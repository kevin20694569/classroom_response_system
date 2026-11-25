import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { QuizSession, SessionResetPayload, SessionStatePayload } from '@crs/shared';
import { pino } from 'pino';
import { io as connect, type Socket } from 'socket.io-client';
import { buildApp, type BuiltApp } from '../../src/app.js';
import { signToken, TOKEN_TTL_MS } from '../../src/auth/tokens.js';
import { LocalSessionRepository } from '../../src/infrastructure/persistence/localSessionRepository.js';
import type { SessionRepository } from '../../src/infrastructure/persistence/sessionRepository.js';
import { FakeGuidedNotesGateway } from '../fakes/fakeGuidedNotesGateway.js';
import { InMemorySessionRepository } from '../fakes/inMemorySessionRepository.js';

export const TEST_PASSWORD = 'teacher-password-for-tests';
export const TEST_SECRET = 'test-secret-'.padEnd(48, 'x');

export interface TestApp extends BuiltApp {
  gateway: FakeGuidedNotesGateway;
  repository: SessionRepository;
  url: string;
  logLines: string[];
  close: () => Promise<void>;
}

/** 啟動測試用伺服器（臨時埠、記憶體保存庫、Guided Notes 替身），並收集 log 輸出。 */
export async function startTestApp(
  options: {
    initial?: QuizSession | null;
    repository?: SessionRepository;
    gateway?: FakeGuidedNotesGateway;
    beforeListen?: (built: BuiltApp) => void;
    /** 縮短組員斷線緩衝時間，測試不必實際等待 30 秒（004） */
    rosterGraceMs?: number;
  } = {},
): Promise<TestApp> {
  const gateway = options.gateway ?? new FakeGuidedNotesGateway();
  const repository = options.repository ?? new InMemorySessionRepository(options.initial ?? null);
  const logLines: string[] = [];
  const logger = pino(
    {
      level: 'info',
      redact: {
        paths: ['password', 'token', 'authorization', '*.authorization'],
        censor: '[已遮蔽]',
      },
    },
    { write: (line: string) => logLines.push(line) },
  );
  const built = await buildApp({
    teacherPassword: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    gateway,
    repository,
    logger,
    ...(options.rosterGraceMs === undefined ? {} : { rosterGraceMs: options.rosterGraceMs }),
  });
  options.beforeListen?.(built);
  await built.app.listen({ port: 0, host: '127.0.0.1' });
  const port = (built.app.server.address() as AddressInfo).port;
  return {
    ...built,
    gateway,
    repository,
    url: `http://127.0.0.1:${port}`,
    logLines,
    close: () => built.app.close(),
  };
}

/** 模擬伺服器重啟：關閉目前的伺服器，以同一個資料目錄與文件替身重新啟動（FR-028）。 */
export async function restartApp(current: TestApp, dataDir: string): Promise<TestApp> {
  await current.close();
  return startTestApp({
    repository: new LocalSessionRepository(dataDir),
    gateway: current.gateway,
  });
}

export async function loginTeacher(app: TestApp): Promise<string> {
  const res = await app.app.inject({
    method: 'POST',
    url: '/api/auth/teacher',
    payload: { password: TEST_PASSWORD },
  });
  return res.json<{ token: string }>().token;
}

/** 以 HTTP 呼叫（帶 token）。 */
export function call(
  app: TestApp,
  method: 'GET' | 'POST',
  url: string,
  token: string | null,
  payload?: object,
) {
  return app.app.inject({
    method,
    url,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    ...(method === 'POST' ? { payload: payload ?? {} } : {}),
  });
}

/** 老師登入並匯入指定的 fixture（spreadsheetId 與 fixture 同名），回傳老師 token。 */
export async function teacherWithImport(
  app: TestApp,
  fixture: string,
  groupCount = 2,
): Promise<string> {
  const { loadFixture } = await import('./fixtures.js');
  app.gateway.set(fixture, loadFixture(fixture));
  const token = await loginTeacher(app);
  const res = await call(app, 'POST', '/api/session/import', token, {
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${fixture}/edit`,
    groupCount,
  });
  if (res.statusCode !== 200) throw new Error(`匯入失敗：${res.body}`);
  return token;
}

/** 學生以 API 加入組別（004：加入時帶暱稱），回傳 token。 */
export async function joinStudent(
  app: TestApp,
  groupId: number,
  nickname = '測試',
): Promise<string> {
  const res = await call(app, 'POST', '/api/auth/student', null, { groupId, nickname });
  if (res.statusCode !== 200) throw new Error(`加入失敗：${res.body}`);
  return res.json<{ token: string }>().token;
}

/** 學生送出答案。 */
export function submitAnswers(
  app: TestApp,
  token: string,
  questionNumber: number,
  texts: string[],
) {
  return call(app, 'POST', '/api/submissions', token, {
    questionNumber,
    answers: texts.map((text, i) => ({ blankIndex: i + 1, text })),
  });
}

/** 直接簽發學生 token（用於學生 API 尚未存在的階段或測試舊活動 token）。 */
export function forgeStudentToken(
  groupId: number,
  activityId: string = randomUUID(),
  member: { memberId?: string; nickname?: string } = {},
): string {
  const now = new Date();
  return signToken(
    {
      role: 'student',
      groupId,
      activityId,
      memberId: member.memberId ?? randomUUID(),
      nickname: member.nickname ?? '測試',
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
    },
    TEST_SECRET,
  );
}

export interface TestSocket {
  socket: Socket;
  states: SessionStatePayload[];
  resets: SessionResetPayload[];
  /** 等待下一個（或已收到的第 n 個）session:state */
  nextState: (
    predicate?: (p: SessionStatePayload) => boolean,
    timeoutMs?: number,
  ) => Promise<SessionStatePayload>;
}

/** 以指定 token 連線；連線被拒絕時 reject（message 為 connect_error 的訊息）。 */
export function connectSocket(url: string, token?: string): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const socket = connect(url, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    const states: SessionStatePayload[] = [];
    const resets: SessionResetPayload[] = [];
    const waiters: {
      predicate: (p: SessionStatePayload) => boolean;
      resolve: (p: SessionStatePayload) => void;
    }[] = [];
    socket.on('session:state', (payload: SessionStatePayload) => {
      states.push(payload);
      for (const waiter of [...waiters]) {
        if (waiter.predicate(payload)) {
          waiters.splice(waiters.indexOf(waiter), 1);
          waiter.resolve(payload);
        }
      }
    });
    socket.on('session:reset', (payload: SessionResetPayload) => {
      resets.push(payload);
    });
    const nextState: TestSocket['nextState'] = (predicate = () => true, timeoutMs = 2000) =>
      new Promise((res, rej) => {
        const timer = setTimeout(() => {
          rej(new Error('等待 session:state 逾時'));
        }, timeoutMs);
        waiters.push({
          predicate,
          resolve: (p) => {
            clearTimeout(timer);
            res(p);
          },
        });
      });
    const first = nextState(() => true);
    socket.on('connect_error', (error) => {
      socket.close();
      reject(error);
    });
    void first.then(() => {
      resolve({ socket, states, resets, nextState });
    }, reject);
  });
}

/**
 * 老師把目前所有送出勾選為答對並按「批改完成」（004 FR-031、FR-034）。
 * 用於沿用 001～003「最先送出即搶答成功」情境的測試：全部答對時，搶答成功就是最先送出的組別。
 */
export async function gradeAllCorrect(app: TestApp, teacherToken: string): Promise<void> {
  for (const s of app.service.getSession().submissions) {
    const res = await call(app, 'POST', '/api/session/grade', teacherToken, {
      submissionId: s.id,
      correct: true,
    });
    if (res.statusCode !== 200) throw new Error(`批改失敗：${res.body}`);
  }
  const done = await call(app, 'POST', '/api/session/grade/finish', teacherToken, {});
  if (done.statusCode !== 200) throw new Error(`批改完成失敗：${done.body}`);
}
