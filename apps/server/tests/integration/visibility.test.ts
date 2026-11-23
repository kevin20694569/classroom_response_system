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
});
