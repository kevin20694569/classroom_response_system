import { afterEach, describe, expect, it } from 'vitest';
import {
  call,
  connectSocket,
  joinStudent,
  startTestApp,
  submitAnswers,
  teacherWithImport,
  type TestApp,
  type TestSocket,
} from '../helpers/testApp.js';
import { loadFixture } from '../helpers/fixtures.js';

/**
 * 資料可見性的專門測試（FR-020、SC-006、constitution 原則 I、VII）：
 * 活動結束前，學生收到的任何資料都不含他組作答、sequence 或搶答成功組別。
 */
let app: TestApp | undefined;
const sockets: TestSocket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.socket.close();
  await app?.close();
  app = undefined;
});

const SECRET_1 = '第一組的秘密答案';
const SECRET_2 = '第二組的秘密答案';

describe('可見性', () => {
  it('結束前學生看不到他組資料；結束後才看到結果', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    const [g1, g2] = await Promise.all([joinStudent(app, 1), joinStudent(app, 2)]);
    const s1 = await connectSocket(app.url, g1);
    const s2 = await connectSocket(app.url, g2);
    sockets.push(s1, s2);

    // 開啟後兩組學生都在 1 秒內收到新狀態（SC-003 學生分頁部分）
    const opened = [s1, s2].map((s) => s.nextState((p) => p.view.status === 'OPEN', 1000));
    await call(app, 'POST', '/api/session/open', teacher);
    await Promise.all(opened);

    const r1 = await submitAnswers(app, g1, 1, [SECRET_1]);
    expect(r1.statusCode).toBe(200);
    expect(r1.body).not.toMatch(/sequence|winner|順位/);
    await s1.nextState((p) => p.view.viewer === 'student' && p.view.ownSubmissions.length === 1);

    const before2 = s1.states.length;
    const r2 = await submitAnswers(app, g2, 1, [SECRET_2]);
    expect(r2.statusCode).toBe(200);
    await s2.nextState((p) => p.view.viewer === 'student' && p.view.ownSubmissions.length === 1);
    // 第 2 組送出時第 1 組不會收到任何事件
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(s1.states.length).toBe(before2);

    const http1 = (await call(app, 'GET', '/api/session', g1)).body;
    const everything1 = [http1, r1.body, ...s1.states.map((p) => JSON.stringify(p))].join('\n');
    expect(everything1).toContain(SECRET_1);
    expect(everything1).not.toContain(SECRET_2);
    expect(everything1).not.toContain('sequence');
    expect(everything1).not.toContain('winnerGroupId');

    const everything2 = [
      (await call(app, 'GET', '/api/session', g2)).body,
      ...s2.states.map((p) => JSON.stringify(p)),
    ].join('\n');
    expect(everything2).not.toContain(SECRET_1);

    // 結束後兩組都收到每題結果，且在 1 秒內同步
    const closed = [s1, s2].map((s) => s.nextState((p) => p.view.status === 'CLOSED', 1000));
    await call(app, 'POST', '/api/session/close', teacher);
    for (const payload of await Promise.all(closed)) {
      if (payload.view.viewer !== 'student') throw new Error('應為學生檢視');
      expect(payload.view.results?.[0]).toMatchObject({ questionNumber: 1, winnerGroupId: 1 });
    }
  });

  it('未登入分頁在任何時候都看不到作答內容', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    const anon = await connectSocket(app.url);
    sockets.push(anon);
    await call(app, 'POST', '/api/session/open', teacher);
    await submitAnswers(app, await joinStudent(app, 1), 1, [SECRET_1]);
    await call(app, 'POST', '/api/session/close', teacher);
    await anon.nextState((p) => p.view.status === 'CLOSED');
    expect(anon.states.map((p) => JSON.stringify(p)).join('')).not.toContain(SECRET_1);
  });

  it('題目敘述：「待開始」以前學生與未登入分頁都收不到；開啟後只有已加入的學生收得到（004 FR-018、FR-019、SC-006）', async () => {
    app = await startTestApp();
    const fixture = loadFixture('group-example');
    const prompts = (fixture.sheets[0]?.cells ?? [])
      .slice(4)
      .map((row) => row[2] ?? '')
      .filter((text) => text !== '');
    expect(prompts.length).toBeGreaterThan(0);

    const teacher = await teacherWithImport(app, 'group-example', 2);
    const student = await joinStudent(app, 1);
    const [teacherSocket, studentSocket, anonSocket] = await Promise.all([
      connectSocket(app.url, teacher),
      connectSocket(app.url, student),
      connectSocket(app.url),
    ]);
    sockets.push(teacherSocket, studentSocket, anonSocket);
    // 「待開始」：學生與未登入分頁收到的推播與回應都不含敘述
    const beforeOpen = [
      (await call(app, 'GET', '/api/session', student)).body,
      (await call(app, 'GET', '/api/session', null)).body,
      ...studentSocket.states.map((p) => JSON.stringify(p)),
      ...anonSocket.states.map((p) => JSON.stringify(p)),
    ].join('\n');
    for (const text of prompts) expect(beforeOpen).not.toContain(text);
    expect(beforeOpen).not.toContain('prompt');

    const opened = [teacherSocket, studentSocket, anonSocket].map((s) =>
      s.nextState((p) => p.view.status === 'OPEN', 1000),
    );
    await call(app, 'POST', '/api/session/open', teacher);
    await Promise.all(opened);
    const closed = [studentSocket, anonSocket].map((s) =>
      s.nextState((p) => p.view.status === 'CLOSED', 1000),
    );
    await call(app, 'POST', '/api/session/close', teacher);
    await Promise.all(closed);

    const teacherData = [
      (await call(app, 'GET', '/api/session', teacher)).body,
      ...teacherSocket.states.map((p) => JSON.stringify(p)),
    ].join('\n');
    for (const text of prompts) expect(teacherData).toContain(text);

    // 開啟後（含已結束）已加入的學生收到敘述，與老師端相同的文字
    const studentAfterOpen = [
      (await call(app, 'GET', '/api/session', student)).body,
      ...studentSocket.states
        .filter((p) => p.view.status !== 'READY')
        .map((p) => JSON.stringify(p)),
    ].join('\n');
    for (const text of prompts) expect(studentAfterOpen).toContain(text);

    // 未登入分頁任何時候都收不到
    const anonymous = [
      (await call(app, 'GET', '/api/session', null)).body,
      ...anonSocket.states.map((p) => JSON.stringify(p)),
    ].join('\n');
    for (const text of prompts) expect(anonymous).not.toContain(text);
    expect(anonymous).not.toContain('prompt');
  });

  it('各階段學生收到的資料只含允許的欄位，題目含子題標記；敘述只在開啟後出現（003 FR-021、004 FR-018）', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'group-example', 2);
    const [g1, g2] = await Promise.all([joinStudent(app, 1), joinStudent(app, 2)]);
    const [s1, s2] = await Promise.all([connectSocket(app.url, g1), connectSocket(app.url, g2)]);
    sockets.push(s1, s2);
    const httpBodies: string[] = [(await call(app, 'GET', '/api/session', g2)).body];

    const opened = [s1, s2].map((s) => s.nextState((p) => p.view.status === 'OPEN', 1000));
    await call(app, 'POST', '/api/session/open', teacher);
    await Promise.all(opened);
    const statesBefore = s2.states.length;
    expect((await submitAnswers(app, g1, 1, [SECRET_1, '第一組的第二格'])).statusCode).toBe(200);
    await s1.nextState((p) => p.view.viewer === 'student' && p.view.ownSubmissions.length === 1);
    // 第 1 組送出時第 2 組沒有收到任何事件
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(s2.states.length).toBe(statesBefore);
    httpBodies.push((await call(app, 'GET', '/api/session', g2)).body);

    const closed = s2.nextState((p) => p.view.status === 'CLOSED', 1000);
    await call(app, 'POST', '/api/session/close', teacher);
    await closed;
    httpBodies.push((await call(app, 'GET', '/api/session', g2)).body);

    const views: Record<string, unknown>[] = [
      ...httpBodies.map((body) => (JSON.parse(body) as { view: Record<string, unknown> }).view),
      ...s2.states.map((p) => p.view as unknown as Record<string, unknown>),
    ];
    for (const view of views) {
      expect(Object.keys(view).sort()).toEqual(
        [
          'groupId',
          'groups',
          'headcounts',
          'members',
          'ownSubmissions',
          'questions',
          'results',
          'status',
          'viewer',
        ].sort(),
      );
      const questions = view.questions as Record<string, unknown>[];
      for (const q of questions) {
        expect(Object.keys(q).sort()).toEqual([
          'blankCount',
          'blankLabels',
          'content',
          'kind',
          'number',
        ]);
        expect((q.blankLabels as unknown[]).length).toBe(q.blankCount);
      }
      expect(view.ownSubmissions).toEqual([]);
      if (view.status !== 'CLOSED') expect(view.results).toBeNull();
      else {
        for (const r of view.results as Record<string, unknown>[]) {
          expect(Object.keys(r).sort()).toEqual([
            'answers',
            'questionNumber',
            'submitterNickname',
            'winnerGroupId',
          ]);
        }
      }
    }
    const everything = [...httpBodies, ...s2.states.map((p) => JSON.stringify(p))].join('\n');
    // 結束前看不到第 1 組的答案；結束後只看得到搶答成功答案（第 1 題由第 1 組搶到）
    const beforeClose = [
      httpBodies[0],
      httpBodies[1],
      ...s2.states.filter((p) => p.view.status !== 'CLOSED').map((p) => JSON.stringify(p)),
    ].join('\n');
    expect(beforeClose).not.toContain(SECRET_1);
    expect(everything).not.toMatch(/sequence|receivedAt/);
    // 「待開始」時的資料不含敘述（004 FR-018）
    expect(httpBodies[0]).not.toContain('prompt');
    expect(everything).toContain('（1）');
  });
});
