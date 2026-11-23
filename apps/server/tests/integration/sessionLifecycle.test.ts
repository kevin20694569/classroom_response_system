import { afterEach, describe, expect, it } from 'vitest';
import { loadFixture } from '../helpers/fixtures.js';
import {
  connectSocket,
  forgeStudentToken,
  loginTeacher,
  startTestApp,
  type TestApp,
  type TestSocket,
} from '../helpers/testApp.js';

let app: TestApp | undefined;
const sockets: TestSocket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.socket.close();
  await app?.close();
  app = undefined;
});

async function track(promise: Promise<TestSocket>): Promise<TestSocket> {
  const s = await promise;
  sockets.push(s);
  return s;
}

function post(a: TestApp, url: string, token: string, payload: object = {}) {
  return a.app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

async function importedApp(): Promise<{ a: TestApp; token: string }> {
  app = await startTestApp();
  app.gateway.set('single-doc', loadFixture('single-example'));
  const token = await loginTeacher(app);
  const res = await post(app, '/api/session/import', token, {
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-doc/edit',
    groupCount: 2,
  });
  expect(res.statusCode).toBe(200);
  return { a: app, token };
}

describe('開啟與結束搶答（US2，FR-012～FR-014）', () => {
  it('老師 A 開啟後，4 個分頁（老師 A、B 與 2 個未登入）都在 1 秒內收到搶答進行中', async () => {
    const { a, token } = await importedApp();
    const tokenB = await loginTeacher(a);
    const watchers = await Promise.all([
      track(connectSocket(a.url, token)),
      track(connectSocket(a.url, tokenB)),
      track(connectSocket(a.url)),
      track(connectSocket(a.url)),
    ]);
    const waits = watchers.map((w) => w.nextState((p) => p.view.status === 'OPEN', 1000));
    const res = await post(a, '/api/session/open', token);
    expect(res.statusCode).toBe(200);
    const payloads = await Promise.all(waits);
    expect(payloads.map((p) => p.view.viewer)).toEqual(['teacher', 'teacher', 'public', 'public']);

    const closing = watchers.map((w) => w.nextState((p) => p.view.status === 'CLOSED', 1000));
    expect((await post(a, '/api/session/close', tokenB)).statusCode).toBe(200);
    await Promise.all(closing);
  });

  it('重複開啟回 ALREADY_IN_STATE；結束後再開啟回 INVALID_TRANSITION', async () => {
    const { a, token } = await importedApp();
    await post(a, '/api/session/open', token);
    const again = await post(a, '/api/session/open', token);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'ALREADY_IN_STATE' } });

    await post(a, '/api/session/close', token);
    const reopen = await post(a, '/api/session/open', token);
    expect(reopen.statusCode).toBe(409);
    expect(reopen.json()).toMatchObject({ error: { code: 'INVALID_TRANSITION' } });
    expect(a.service.getSession().status).toBe('CLOSED');
  });

  it('尚未匯入就開啟回 INVALID_TRANSITION', async () => {
    app = await startTestApp();
    const token = await loginTeacher(app);
    const res = await post(app, '/api/session/open', token);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_TRANSITION' } });
  });

  it('學生 token 呼叫開啟與結束回 403', async () => {
    const { a } = await importedApp();
    const student = forgeStudentToken(1, a.service.getSession().activityId ?? '');
    expect((await post(a, '/api/session/open', student)).statusCode).toBe(403);
    expect((await post(a, '/api/session/close', student)).statusCode).toBe(403);
  });

  it('斷線重連後立即收到目前完整狀態，耗時小於 3 秒（SC-004）', async () => {
    const { a, token } = await importedApp();
    await post(a, '/api/session/open', token);
    const first = await connectSocket(a.url, token);
    expect(first.states[0]?.view.status).toBe('OPEN');
    first.socket.close();

    const started = Date.now();
    const again = await track(connectSocket(a.url, token));
    expect(Date.now() - started).toBeLessThan(3000);
    expect(again.states[0]?.view).toMatchObject({ viewer: 'teacher', status: 'OPEN' });
    expect(again.states[0]?.view.questions).toHaveLength(6);
  });
});
