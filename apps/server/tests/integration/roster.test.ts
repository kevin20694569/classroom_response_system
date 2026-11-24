import type { PublicView, SessionStatePayload, StudentView } from '@crs/shared';
import { afterEach, describe, expect, it } from 'vitest';
import {
  call,
  connectSocket,
  joinStudent,
  submitAnswers,
  startTestApp,
  teacherWithImport,
  type TestApp,
  type TestSocket,
} from '../helpers/testApp.js';

/**
 * 組員名冊與各組人數（004 US2、FR-009～FR-015、SC-003～SC-006）：
 * 以真實的 Socket.IO 用戶端連線，驗證推播、重新整理、斷線緩衝、離開組別與可見性。
 */
let app: TestApp | undefined;
const sockets: TestSocket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.socket.close();
  await app?.close();
  app = undefined;
});

async function open(token?: string): Promise<TestSocket> {
  const s = await connectSocket(app?.url ?? '', token);
  sockets.push(s);
  return s;
}

const counts = (p: SessionStatePayload): number[] =>
  (p.view as PublicView | StudentView).headcounts.map((h) => h.memberCount);
const members = (p: SessionStatePayload): string[] =>
  (p.view as StudentView).members.map((m) => m.nickname);
const sameCounts = (expected: number[]) => (p: SessionStatePayload) =>
  p.view.viewer !== 'teacher' && JSON.stringify(counts(p)) === JSON.stringify(expected);
/** 等到最新的一份資料是指定人數（已經是就直接完成，避免推播先到、等待後註冊的競態）。 */
const reach = (s: TestSocket, expected: number[]): Promise<SessionStatePayload> => {
  const last = s.states.at(-1);
  if (last !== undefined && sameCounts(expected)(last)) return Promise.resolve(last);
  return s.nextState(sameCounts(expected), 1000);
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('組員名冊與各組人數', () => {
  it('學生連線後，選組中的分頁與同組分頁在 1 秒內收到新的人數與成員（SC-003）', async () => {
    app = await startTestApp();
    await teacherWithImport(app, 'single-example', 3);
    const lobby = await open();
    expect(counts(lobby.states[0] as SessionStatePayload)).toEqual([0, 0, 0]);

    const milo = await joinStudent(app, 1, 'Milo');
    const lobbyUpdate = lobby.nextState(sameCounts([1, 0, 0]), 1000);
    const miloSocket = await open(milo);
    await lobbyUpdate;
    // 自己的第一份資料就包含自己
    expect(members(miloSocket.states[0] as SessionStatePayload)).toEqual(['Milo']);

    const miloUpdate = miloSocket.nextState((p) => members(p).length === 2, 1000);
    const lobbySecond = lobby.nextState(sameCounts([2, 0, 0]), 1000);
    await open(await joinStudent(app, 1, 'Ava'));
    expect(members(await miloUpdate)).toEqual(['Milo', 'Ava']);
    await lobbySecond;
  });

  it('同一 token 連續斷線後立即重連 20 次，人數一直不變（SC-004）', async () => {
    app = await startTestApp();
    await teacherWithImport(app, 'single-example', 2);
    const lobby = await open();
    const token = await joinStudent(app, 2, 'Milo');
    let current = await open(token);
    for (let i = 0; i < 20; i += 1) {
      current.socket.close();
      current = await open(token);
      expect(counts(current.states[0] as SessionStatePayload)).toEqual([0, 1]);
    }
    await wait(100);
    for (const p of lobby.states) expect(counts(p)[1]).toBeLessThanOrEqual(1);
    expect(counts(lobby.states.at(-1) as SessionStatePayload)).toEqual([0, 1]);
  });

  it('斷線超過緩衝時間才移出名冊（以縮短的緩衝時間測試，SC-005）', async () => {
    app = await startTestApp({ rosterGraceMs: 200 });
    await teacherWithImport(app, 'single-example', 2);
    const lobby = await open();
    const s = await open(await joinStudent(app, 1, 'Milo'));
    await reach(lobby, [1, 0]);
    s.socket.close();
    await wait(100);
    expect(counts(lobby.states.at(-1) as SessionStatePayload)).toEqual([1, 0]);
    await reach(lobby, [0, 0]);
    expect(app.logLines.join('\n')).toContain('student.roster.removed');
  });

  it('離開組別：待開始回 204 且人數立即減 1；之後同一身分連線與送出都被拒', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    const lobby = await open();
    const token = await joinStudent(app, 1, 'Milo');
    const s = await open(token);
    await reach(lobby, [1, 0]);

    const update = lobby.nextState(sameCounts([0, 0]), 1000);
    const res = await call(app, 'POST', '/api/auth/student/leave', token, {});
    expect(res.statusCode).toBe(204);
    await update;
    expect(app.logLines.join('\n')).toContain('student.left');
    // 伺服器中斷已離開組員仍連著的連線
    await wait(50);
    expect(s.socket.connected).toBe(false);

    await expect(connectSocket(app.url, token)).rejects.toThrow();
    await call(app, 'POST', '/api/session/open', teacher);
    const submit = await submitAnswers(app, token, 1, ['答案']);
    expect(submit.statusCode).toBe(401);
  });

  it('離開組別：搶答開始後回 409，老師 token 回 403，沒有 token 回 401', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    const token = await joinStudent(app, 1, 'Milo');
    await call(app, 'POST', '/api/session/open', teacher);
    const opened = await call(app, 'POST', '/api/auth/student/leave', token, {});
    expect(opened.statusCode).toBe(409);
    expect(opened.json()).toEqual({
      error: { code: 'LEAVE_NOT_ALLOWED', message: '搶答已開始，無法離開組別。' },
    });
    await call(app, 'POST', '/api/session/close', teacher);
    expect((await call(app, 'POST', '/api/auth/student/leave', token, {})).statusCode).toBe(409);
    expect((await call(app, 'POST', '/api/auth/student/leave', teacher, {})).statusCode).toBe(403);
    expect((await call(app, 'POST', '/api/auth/student/leave', null, {})).statusCode).toBe(401);
  });

  it('老師重新匯入後名冊清空，各組人數從 0 開始（FR-015）', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    const lobby = await open();
    await open(await joinStudent(app, 1, 'Milo'));
    await reach(lobby, [1, 0]);
    const reimport = await call(app, 'POST', '/api/session/import', teacher, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-example/edit',
      groupCount: 2,
    });
    expect(reimport.statusCode).toBe(200);
    await reach(lobby, [0, 0]);
    expect(app.roster.headcounts(app.service.getSession().groups)).toEqual([
      { groupId: 1, memberCount: 0 },
      { groupId: 2, memberCount: 0 },
    ]);
  });

  it('學生收到的資料不含其他組的成員名單；未登入分頁沒有任何成員名單（FR-014、SC-006）', async () => {
    app = await startTestApp();
    await teacherWithImport(app, 'single-example', 2);
    const lobby = await open();
    const first = await open(await joinStudent(app, 1, '第一組的小明'));
    const second = await open(await joinStudent(app, 2, '第二組的阿華'));
    await reach(lobby, [1, 1]);
    await wait(100);
    const all = (s: TestSocket) => s.states.map((p) => JSON.stringify(p)).join('\n');
    expect(all(first)).not.toContain('第二組的阿華');
    expect(all(second)).not.toContain('第一組的小明');
    expect(all(lobby)).not.toContain('第一組的小明');
    expect(all(lobby)).not.toContain('第二組的阿華');
    const http = await call(app, 'GET', '/api/session', null);
    expect(http.body).not.toContain('小明');
  });

  it('加入、離開、斷線移除時寫出的 log 不含暱稱與 token（FR-022）', async () => {
    app = await startTestApp({ rosterGraceMs: 50 });
    await teacherWithImport(app, 'single-example', 2);
    const lobby = await open();
    const stay = await joinStudent(app, 1, '留下的暱稱');
    const leave = await joinStudent(app, 2, '離開的暱稱');
    const s = await open(stay);
    await open(leave);
    await reach(lobby, [1, 1]);
    await call(app, 'POST', '/api/auth/student/leave', leave, {});
    s.socket.close();
    await reach(lobby, [0, 0]);
    const logs = app.logLines.join('\n');
    expect(logs).toContain('student.joined');
    expect(logs).toContain('student.left');
    expect(logs).toContain('student.roster.removed');
    for (const secret of ['留下的暱稱', '離開的暱稱', stay, leave]) {
      expect(logs).not.toContain(secret);
    }
  });
});
