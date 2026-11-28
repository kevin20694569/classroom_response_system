import {
  SessionStatePayloadSchema,
  type GroupOverview,
  type PublicView,
  type SessionStatePayload,
  type StudentView,
} from '@crs/shared';
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
/**
 * 006 Constitution V：老師收到的每一份推播都必須通過共用契約（含 groupOverview 的不變式）；
 * 前端以同一個 schema 驗證，不通過的推播會被丟棄、面板就不會更新。
 */
const expectValidStates = (s: TestSocket): void => {
  expect(s.states.length).toBeGreaterThan(0);
  for (const p of s.states) expect(SessionStatePayloadSchema.safeParse(p).success).toBe(true);
};

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

describe('006：老師端分組情況推播（FR-005、FR-016、FR-021、SC-002、SC-005）', () => {
  const overviewOf = (p: SessionStatePayload): GroupOverview[] =>
    p.view.viewer === 'teacher' ? p.view.groupOverview : [];
  const groupMembers = (p: SessionStatePayload, groupId: number) =>
    overviewOf(p).find((g) => g.groupId === groupId)?.members ?? [];
  const names = (p: SessionStatePayload, groupId: number): string[] =>
    groupMembers(p, groupId).map((m) => m.nickname);

  it('加入、斷線、緩衝內重連、緩衝到期、離開組別與重新匯入，老師都在 1 秒內收到更新', async () => {
    app = await startTestApp({ rosterGraceMs: 400 });
    const teacherToken = await teacherWithImport(app, 'single-example', 2);
    const teacher = await open(teacherToken);
    expect(overviewOf(teacher.states[0] as SessionStatePayload).map((g) => g.memberCount)).toEqual([
      0, 0,
    ]);

    const miloToken = await joinStudent(app, 1, 'Milo');
    const joined = teacher.nextState((p) => names(p, 1).join() === 'Milo', 1000);
    const milo = await open(miloToken);
    await joined;

    const disconnected = teacher.nextState(
      (p) => groupMembers(p, 1)[0]?.disconnected === true,
      1000,
    );
    milo.socket.close();
    const graceState = await disconnected;
    expect(overviewOf(graceState)[0]?.memberCount).toBe(1);

    const reconnected = teacher.nextState(
      (p) => groupMembers(p, 1)[0]?.disconnected === false,
      1000,
    );
    const miloAgain = await open(miloToken);
    await reconnected;

    const removed = teacher.nextState((p) => names(p, 1).length === 0, 2000);
    miloAgain.socket.close();
    await removed;
    expect(app.logLines.join('\n')).toContain('student.roster.disconnected');
    expect(app.logLines.join('\n')).toContain('student.roster.reconnected');

    const avaToken = await joinStudent(app, 2, 'Ava');
    const avaJoined = teacher.nextState((p) => names(p, 2).join() === 'Ava', 1000);
    await open(avaToken);
    await avaJoined;
    const avaLeft = teacher.nextState((p) => names(p, 2).length === 0, 1000);
    expect((await call(app, 'POST', '/api/auth/student/leave', avaToken, {})).statusCode).toBe(204);
    await avaLeft;

    // 先開始等待再連線：伺服器在送出 Leo 自己的第一份資料之前就推播老師，
    // 連線完成後才等待，老師的那份推播可能已經先到而錯過
    const leoToken = await joinStudent(app, 1, 'Leo');
    const leoJoined = teacher.nextState((p) => names(p, 1).join() === 'Leo', 1000);
    await open(leoToken);
    await leoJoined;
    const cleared = teacher.nextState(
      (p) => overviewOf(p).length === 2 && overviewOf(p).every((g) => g.memberCount === 0),
      1000,
    );
    await call(app, 'POST', '/api/session/import', teacherToken, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-example/edit',
      groupCount: 2,
    });
    await cleared;
    expectValidStates(teacher);
  });

  it('斷線與緩衝內重連只推給老師；學生與未登入分頁收不到連線狀態', async () => {
    app = await startTestApp({ rosterGraceMs: 5000 });
    const teacher = await open(await teacherWithImport(app, 'single-example', 2));
    const lobby = await open();
    const aToken = await joinStudent(app, 1, 'Milo');
    const a = await open(aToken);
    const b = await open(await joinStudent(app, 1, 'Ava'));
    await reach(lobby, [2, 0]);
    // 推播可能已經先到：最新一份就是兩人時不必再等
    const latest = teacher.states.at(-1);
    if (latest === undefined || names(latest, 1).length !== 2) {
      await teacher.nextState((p) => names(p, 1).length === 2, 1000);
    }
    await wait(100);
    const lobbyCount = lobby.states.length;
    const bCount = b.states.length;

    const disconnected = teacher.nextState(
      (p) => groupMembers(p, 1)[0]?.disconnected === true,
      1000,
    );
    a.socket.close();
    await disconnected;
    const reconnected = teacher.nextState(
      (p) => groupMembers(p, 1)[0]?.disconnected === false,
      1000,
    );
    await open(aToken);
    await reconnected;
    await wait(100);

    expect(lobby.states.length).toBe(lobbyCount);
    expect(b.states.length).toBe(bCount);
    for (const s of [lobby, b]) {
      const json = s.states.map((p) => JSON.stringify(p)).join('\n');
      expect(json).not.toContain('groupOverview');
      expect(json).not.toContain('disconnected');
    }
    expectValidStates(teacher);
  });
});

describe('006：老師端回答標註推播（FR-007～FR-010、US2）', () => {
  const overviewOf = (p: SessionStatePayload): GroupOverview[] =>
    p.view.viewer === 'teacher' ? p.view.groupOverview : [];
  const firstMember = (p: SessionStatePayload, groupId: number) =>
    overviewOf(p).find((g) => g.groupId === groupId)?.members[0];

  it('送出後老師在送出者旁看到題號；送出者斷線逾時後以「不在組內」保留；他組學生收不到事件', async () => {
    app = await startTestApp({ rosterGraceMs: 300 });
    const teacherToken = await teacherWithImport(app, 'single-example', 2);
    const teacher = await open(teacherToken);
    const miloToken = await joinStudent(app, 1, 'Milo');
    const milo = await open(miloToken);
    const other = await open(await joinStudent(app, 2, 'Leo'));
    await call(app, 'POST', '/api/session/open', teacherToken);
    await wait(100);
    const otherCount = other.states.length;

    const tagged = teacher.nextState(
      (p) => firstMember(p, 1)?.answered.some((t) => t.questionNumber === 1) === true,
      1000,
    );
    expect((await submitAnswers(app, miloToken, 1, ['CPU'])).statusCode).toBe(200);
    const taggedState = await tagged;
    expect(firstMember(taggedState, 1)?.answered).toEqual([{ questionNumber: 1, isWinner: true }]);
    await wait(100);
    expect(other.states.length).toBe(otherCount);

    const absent = teacher.nextState((p) => firstMember(p, 1)?.inGroup === false, 2000);
    milo.socket.close();
    const absentState = await absent;
    expect(overviewOf(absentState)[0]?.memberCount).toBe(0);
    expect(firstMember(absentState, 1)).toMatchObject({
      nickname: 'Milo',
      answered: [{ questionNumber: 1, isWinner: true }],
    });
    expectValidStates(teacher);
  });
});
