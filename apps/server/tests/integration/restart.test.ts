import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalSessionRepository } from '../../src/infrastructure/persistence/localSessionRepository.js';
import { FakeGuidedNotesGateway } from '../fakes/fakeGuidedNotesGateway.js';
import { loadFixture } from '../helpers/fixtures.js';
import { loginTeacher, restartApp, startTestApp, type TestApp } from '../helpers/testApp.js';

/**
 * 伺服器重啟恢復（FR-028、SC-010）：以同一個資料目錄重建伺服器，狀態與重啟前完全相同。
 * 本檔涵蓋「待開始」與「搶答進行中」；有作答紀錄與已匯出的情境分別在 submissions、export 測試補測。
 */
let dataDir: string;
let app: TestApp | undefined;
beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'crs-restart-'));
});
afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dataDir, { recursive: true, force: true });
});

async function startWithDisk(): Promise<{ a: TestApp; token: string }> {
  const gateway = new FakeGuidedNotesGateway();
  gateway.set('group-doc', loadFixture('group-example'));
  const a = await startTestApp({ repository: new LocalSessionRepository(dataDir), gateway });
  const token = await loginTeacher(a);
  const res = await a.app.inject({
    method: 'POST',
    url: '/api/session/import',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/group-doc/edit',
      groupCount: 3,
    },
  });
  expect(res.statusCode).toBe(200);
  return { a, token };
}

describe('伺服器重啟恢復', () => {
  it('(a) 待開始時重啟：狀態、題目、activityId、nextSequence 不變', async () => {
    const { a } = await startWithDisk();
    const before = structuredClone(a.service.getSession());
    app = await restartApp(a, dataDir);
    expect(app.service.getSession()).toEqual(before);
  });

  it('(b) 搶答進行中時重啟：仍為搶答進行中，老師 token 仍可使用（FR-003a）', async () => {
    const { a, token } = await startWithDisk();
    await a.app.inject({
      method: 'POST',
      url: '/api/session/open',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const before = structuredClone(a.service.getSession());
    app = await restartApp(a, dataDir);
    expect(app.service.getSession()).toEqual(before);
    expect(app.service.getSession().status).toBe('OPEN');

    const view = await app.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(view.json()).toMatchObject({ view: { viewer: 'teacher', status: 'OPEN' } });
    const close = await app.app.inject({
      method: 'POST',
      url: '/api/session/close',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(close.statusCode).toBe(200);
  });

  it('(c) 001 格式的保存檔（沒有題目敘述欄位）可以載入，敘述為 null（002 research R2）', async () => {
    const { a } = await startWithDisk();
    await a.close();
    // 移除 002 新增的欄位，模擬 001 寫出的保存檔
    const file = path.join(dataDir, 'session.json');
    const saved = JSON.parse(await readFile(file, 'utf8')) as {
      session: { questions: Record<string, unknown>[] };
    };
    for (const question of saved.session.questions) {
      delete question.prompt;
      for (const blank of question.blanks as Record<string, unknown>[]) delete blank.prompt;
    }
    await writeFile(file, JSON.stringify(saved), 'utf8');

    app = await startTestApp({
      repository: new LocalSessionRepository(dataDir),
      gateway: a.gateway,
    });
    const token = await loginTeacher(app);
    const res = await app.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const { view } = res.json<{
      view: { questions: { prompt: string | null; blanks: { prompt: string | null }[] }[] };
    }>();
    expect(view.questions).toHaveLength(4);
    for (const q of view.questions) {
      expect(q.prompt).toBeNull();
      expect(q.blanks.every((b) => b.prompt === null)).toBe(true);
    }
  });

  it('(d) 搶答進行中重啟：openedAt 不變、serverNow 為重啟後的時間，前端據此接續計時（002 FR-012，支援 US2）', async () => {
    const { a, token } = await startWithDisk();
    await a.app.inject({
      method: 'POST',
      url: '/api/session/open',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const openedAt = a.service.getSession().openedAt;
    expect(openedAt).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    app = await restartApp(a, dataDir);
    const res = await app.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { authorization: `Bearer ${token}` },
    });
    const { view } = res.json<{ view: { openedAt: string; serverNow: string; status: string } }>();
    expect(view.status).toBe('OPEN');
    expect(view.openedAt).toBe(openedAt);
    expect(Date.parse(view.serverNow)).toBeGreaterThan(Date.parse(view.openedAt));
  });
});
