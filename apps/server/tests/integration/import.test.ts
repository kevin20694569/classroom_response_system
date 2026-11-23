import { afterEach, describe, expect, it } from 'vitest';
import { loadFixture } from '../helpers/fixtures.js';
import {
  connectSocket,
  forgeStudentToken,
  loginTeacher,
  startTestApp,
  type TestApp,
} from '../helpers/testApp.js';

let app: TestApp | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function setup(): Promise<{ app: TestApp; token: string }> {
  app = await startTestApp();
  app.gateway.set('single-doc', loadFixture('single-example'));
  app.gateway.set('group-doc', loadFixture('group-example'));
  app.gateway.set('bad-doc', loadFixture('duplicate-number'));
  return { app, token: await loginTeacher(app) };
}

function importRequest(a: TestApp, token: string | null, payload: object) {
  return a.app.inject({
    method: 'POST',
    url: '/api/session/import',
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    payload,
  });
}

describe('POST /api/session/import（US1）', () => {
  it('老師匯入兩份範例成功，且即時推播新狀態', async () => {
    const { app: a, token } = await setup();
    const watcher = await connectSocket(a.url);

    const res = await importRequest(a, token, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-doc/edit',
      groupCount: 2,
    });
    expect(res.statusCode).toBe(200);
    const view = res.json<{ view: { status: string; questions: unknown[]; source: unknown } }>()
      .view;
    expect(view.status).toBe('READY');
    expect(view.questions).toHaveLength(6);
    expect(view.source).toEqual({ spreadsheetId: 'single-doc', sheetTitle: '學習單' });

    const pushed = await watcher.nextState((p) => p.view.status === 'READY');
    expect(pushed.view.questions).toHaveLength(6);

    const group = await importRequest(a, token, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/group-doc/edit',
      groupCount: 3,
    });
    expect(
      group.json<{ view: { questions: { kind: string; blankCount: number }[] } }>().view.questions,
    ).toEqual([
      { number: 1, kind: 'group', blankCount: 2 },
      { number: 2, kind: 'group', blankCount: 2 },
      { number: 3, kind: 'single', blankCount: 1 },
      { number: 4, kind: 'single', blankCount: 1 },
    ]);
    watcher.socket.close();
  });

  it('格式錯誤回 422 GUIDED_NOTES_INVALID 並帶位置，資料不變', async () => {
    const { app: a, token } = await setup();
    const res = await importRequest(a, token, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/bad-doc/edit',
      groupCount: 2,
    });
    expect(res.statusCode).toBe(422);
    const body = res.json<{ error: { code: string; details: { code: string; row: number }[] } }>();
    expect(body.error.code).toBe('GUIDED_NOTES_INVALID');
    expect(body.error.details[0]).toMatchObject({ code: 'DUPLICATE_QUESTION_NUMBER', row: 11 });
    expect(a.service.getSession().status).toBe('NOT_IMPORTED');
  });

  it('網址無效回 400、文件無法存取回 502', async () => {
    const { app: a, token } = await setup();
    const bad = await importRequest(a, token, { spreadsheetUrl: 'hello', groupCount: 2 });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: { code: 'INVALID_SPREADSHEET_URL' } });

    const missing = await importRequest(a, token, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/not-shared/edit',
      groupCount: 2,
    });
    expect(missing.statusCode).toBe(502);
    expect(missing.json()).toMatchObject({ error: { code: 'SHEETS_UNAVAILABLE' } });
  });

  it('組數超出 2～20 時回 VALIDATION_FAILED', async () => {
    const { app: a, token } = await setup();
    const res = await importRequest(a, token, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-doc/edit',
      groupCount: 21,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('不帶 token 回 401、學生 token 回 403', async () => {
    const { app: a } = await setup();
    const payload = {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-doc/edit',
      groupCount: 2,
    };
    expect((await importRequest(a, null, payload)).statusCode).toBe(401);
    // 學生 token 必須屬於目前活動才算有效，先匯入取得 activityId
    const teacher = await loginTeacher(a);
    await importRequest(a, teacher, payload);
    const activityId = a.service.getSession().activityId ?? '';
    const res = await importRequest(a, forgeStudentToken(1, activityId), payload);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });
});
