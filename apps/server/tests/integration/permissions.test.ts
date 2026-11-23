import { afterEach, describe, expect, it } from 'vitest';
import {
  call,
  joinStudent,
  startTestApp,
  submitAnswers,
  teacherWithImport,
  type TestApp,
} from '../helpers/testApp.js';

/**
 * 權限的專門測試（FR-002、constitution 原則 VII、VIII）：
 * 集中驗證所有老師專屬 API 的完整權限清單（各 story 的整合測試已各自檢查自己新增的 API，
 * 本任務確保沒有遺漏）。
 */
const TEACHER_ONLY: { url: string; payload: object }[] = [
  {
    url: '/api/session/import',
    payload: {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-example/edit',
      groupCount: 2,
    },
  },
  { url: '/api/session/open', payload: {} },
  { url: '/api/session/close', payload: {} },
  { url: '/api/session/export', payload: {} },
];

let app: TestApp | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('權限', () => {
  it('學生 token 呼叫任何老師專屬 API 都回 403，狀態不變', async () => {
    app = await startTestApp();
    await teacherWithImport(app, 'single-example', 2);
    const student = await joinStudent(app, 1);
    const before = app.service.getSession();
    for (const { url, payload } of TEACHER_ONLY) {
      const res = await call(app, 'POST', url, student, payload);
      expect(res.statusCode, url).toBe(403);
      expect(res.json(), url).toMatchObject({ error: { code: 'FORBIDDEN' } });
    }
    expect(app.service.getSession()).toBe(before);
  });

  it('不帶 token 呼叫任何老師專屬 API 都回 401', async () => {
    app = await startTestApp();
    for (const { url, payload } of TEACHER_ONLY) {
      const res = await call(app, 'POST', url, null, payload);
      expect(res.statusCode, url).toBe(401);
      expect(res.json(), url).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    }
  });

  it('老師 token 不能送出答案（403）', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    await call(app, 'POST', '/api/session/open', teacher);
    const res = await submitAnswers(app, teacher, 1, ['CPU']);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });
});
