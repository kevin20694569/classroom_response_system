import { AuthResponseSchema } from '@crs/shared';
import { afterEach, describe, expect, it } from 'vitest';
import {
  call,
  forgeStudentToken,
  connectSocket,
  joinStudent,
  loginTeacher,
  startTestApp,
  teacherWithImport,
  TEST_PASSWORD,
  type TestApp,
} from '../helpers/testApp.js';

let app: TestApp | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('老師登入與身分（FR-003、FR-003a）', () => {
  it('密碼正確時取得 token，錯誤時回 INVALID_PASSWORD 且不透露密碼', async () => {
    app = await startTestApp();
    const ok = await app.app.inject({
      method: 'POST',
      url: '/api/auth/teacher',
      payload: { password: TEST_PASSWORD },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ identity: { role: 'teacher' } });

    const bad = await app.app.inject({
      method: 'POST',
      url: '/api/auth/teacher',
      payload: { password: 'wrong' },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toMatchObject({ error: { code: 'INVALID_PASSWORD' } });
    expect(bad.body).not.toContain(TEST_PASSWORD);
  });

  it('請求格式錯誤時回 VALIDATION_FAILED', async () => {
    app = await startTestApp();
    const res = await app.app.inject({
      method: 'POST',
      url: '/api/auth/teacher',
      payload: { pwd: 'x' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('GET /api/session 依身分回傳不同檢視', async () => {
    app = await startTestApp();
    const anon = await app.app.inject({ method: 'GET', url: '/api/session' });
    expect(anon.json()).toMatchObject({ view: { viewer: 'public', status: 'NOT_IMPORTED' } });

    const token = await loginTeacher(app);
    const teacher = await app.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(teacher.json()).toMatchObject({ view: { viewer: 'teacher' } });

    const invalid = await app.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { authorization: 'Bearer forged.token' },
    });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('學生 token 屬於舊活動時回 401', async () => {
    app = await startTestApp();
    const res = await app.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { authorization: `Bearer ${forgeStudentToken(1)}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Socket.IO 連線身分（contracts/realtime-events.md）', () => {
  it('不帶 token 收到 PublicView、老師收到 TeacherView、無效 token 被拒絕', async () => {
    app = await startTestApp();
    const anon = await connectSocket(app.url);
    expect(anon.states[0]?.view.viewer).toBe('public');

    const token = await loginTeacher(app);
    const teacher = await connectSocket(app.url, token);
    expect(teacher.states[0]?.view.viewer).toBe('teacher');

    await expect(connectSocket(app.url, 'forged.token')).rejects.toThrow('UNAUTHORIZED');
    anon.socket.close();
    teacher.socket.close();
  });

  it('兩個不同 token 的連線互不影響', async () => {
    app = await startTestApp();
    const tokenA = await loginTeacher(app);
    const a = await connectSocket(app.url, tokenA);
    const b = await connectSocket(app.url);
    expect(a.states[0]?.view.viewer).toBe('teacher');
    expect(b.states[0]?.view.viewer).toBe('public');
    a.socket.close();
    expect(b.socket.connected).toBe(true);
    b.socket.close();
  });
});

describe('錯誤不洩漏內部細節（FR-026、原則 VIII）', () => {
  it('找不到的 API 一律回契約格式的 404（不論前端是否已建置）', async () => {
    app = await startTestApp();
    for (const method of ['GET', 'POST'] as const) {
      const res = await app.app.inject({ method, url: '/api/does-not-exist' });
      expect(res.statusCode).toBe(404);
      const body = res.json<{ error: { code: string; message: string } }>();
      expect(body.error.message).toBe('找不到這個 API。');
      expect(Object.keys(body)).toEqual(['error']);
      expect(res.body).not.toContain('Route');
    }
  });

  it('未預期錯誤回 500 通用訊息，不含堆疊、路徑或例外原文', async () => {
    app = await startTestApp({
      beforeListen: ({ app: fastify }) => {
        fastify.get('/api/__boom', () => {
          throw new Error('secret detail at /Users/someone/project/file.ts');
        });
      },
    });
    const res = await app.app.inject({ method: 'GET', url: '/api/__boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: '系統發生錯誤，請稍後再試。' },
    });
    expect(res.body).not.toContain('secret detail');
    expect(res.body).not.toContain('/Users/');
    expect(res.body).not.toContain('at ');
  });

  it('log 不會出現 token 與密碼', async () => {
    app = await startTestApp();
    const token = await loginTeacher(app);
    await app.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { authorization: `Bearer ${token}` },
    });
    const logs = app.logLines.join('\n');
    expect(logs).not.toContain(token);
    expect(logs).not.toContain(TEST_PASSWORD);
  });

  it('學生加入成功與被拒都有結構化 log，且不含 token（003 FR-028）', async () => {
    app = await startTestApp();
    const rejected = await app.app.inject({
      method: 'POST',
      url: '/api/auth/student',
      payload: { groupId: 1, nickname: '測試' },
    });
    expect(rejected.json()).toMatchObject({ error: { code: 'NO_ACTIVE_ACTIVITY' } });
    await teacherWithImport(app, 'single-example');
    const token = await joinStudent(app, 2);
    const logs = app.logLines.join('\n');
    expect(logs).toContain('student.join.rejected');
    expect(logs).toContain('NO_ACTIVE_ACTIVITY');
    expect(logs).toContain('student.joined');
    expect(logs).not.toContain(token);
  });

  it('004：加入成功回應含 memberId 與正規化後的暱稱；log 含 memberId、不含暱稱', async () => {
    app = await startTestApp();
    await teacherWithImport(app, 'single-example');
    const res = await call(app, 'POST', '/api/auth/student', null, {
      groupId: 2,
      nickname: '  暱稱測試  ',
    });
    expect(res.statusCode).toBe(200);
    const body = AuthResponseSchema.parse(res.json());
    expect(body.identity).toMatchObject({ role: 'student', groupId: 2, nickname: '暱稱測試' });
    if (body.identity.role !== 'student') throw new Error('應為學生身分');
    const logs = app.logLines.join('\n');
    expect(logs).toContain(body.identity.memberId);
    expect(logs).not.toContain('暱稱測試');
  });

  it('004：暱稱不符規則時回 400 VALIDATION_FAILED 與規則說明', async () => {
    app = await startTestApp();
    await teacherWithImport(app, 'single-example');
    for (const nickname of ['', '   ', '字'.repeat(21), 'a\nb']) {
      const res = await call(app, 'POST', '/api/auth/student', null, { groupId: 1, nickname });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: { code: 'VALIDATION_FAILED', message: '暱稱需為 1～20 字，且不能只有空白。' },
      });
    }
    const missing = await call(app, 'POST', '/api/auth/student', null, { groupId: 1 });
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('004：暱稱可以重複（FR-005）', async () => {
    app = await startTestApp();
    await teacherWithImport(app, 'single-example');
    const a = await call(app, 'POST', '/api/auth/student', null, { groupId: 1, nickname: 'Milo' });
    const b = await call(app, 'POST', '/api/auth/student', null, { groupId: 1, nickname: 'Milo' });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
  });
});
