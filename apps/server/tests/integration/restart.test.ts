import { mkdtemp, rm } from 'node:fs/promises';
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
});
