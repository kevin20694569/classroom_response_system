import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalSessionRepository } from '../../src/infrastructure/persistence/localSessionRepository.js';
import type { SpreadsheetSnapshot } from '../../src/infrastructure/sheets/guidedNotesGateway.js';
import {
  call,
  connectSocket,
  joinStudent,
  restartApp,
  startTestApp,
  submitAnswers,
  teacherWithImport,
  type TestApp,
  type TestSocket,
} from '../helpers/testApp.js';

let app: TestApp | undefined;
let dataDir: string | undefined;
const sockets: TestSocket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.socket.close();
  await app?.close();
  app = undefined;
  if (dataDir !== undefined) await rm(dataDir, { recursive: true, force: true });
  dataDir = undefined;
});

/** 列出兩份文件內容不同的儲存格（"列,欄" → [前, 後]）。 */
function diffCells(before: SpreadsheetSnapshot, after: SpreadsheetSnapshot) {
  const diffs: Record<string, [string, string]> = {};
  before.sheets.forEach((sheet, s) => {
    const other = after.sheets[s];
    const rows = Math.max(sheet.cells.length, other?.cells.length ?? 0);
    for (let r = 0; r < rows; r += 1) {
      const cols = Math.max(sheet.cells[r]?.length ?? 0, other?.cells[r]?.length ?? 0);
      for (let c = 0; c < cols; c += 1) {
        const a = sheet.cells[r]?.[c] ?? '';
        const b = other?.cells[r]?.[c] ?? '';
        if (a !== b) diffs[`${r},${c}`] = [a, b];
      }
    }
  });
  return diffs;
}

/** 跑完整活動：匯入 → 開啟 → 兩組送出 → 結束。 */
async function runActivity(
  a: TestApp,
  fixture: string,
  plan: { group: number; question: number; answers: string[] }[],
): Promise<string> {
  const teacher = await teacherWithImport(a, fixture, 2);
  await call(a, 'POST', '/api/session/open', teacher);
  const tokens = new Map<number, string>();
  for (const step of plan) {
    const token = tokens.get(step.group) ?? (await joinStudent(a, step.group));
    tokens.set(step.group, token);
    expect((await submitAnswers(a, token, step.question, step.answers)).statusCode).toBe(200);
  }
  await call(a, 'POST', '/api/session/close', teacher);
  return teacher;
}

describe('匯出至原 Guided Notes（US4，SC-007）', () => {
  it('單題範例：只改搶答成功題目的作答格，其他儲存格完全相同；重複匯出結果相同', async () => {
    app = await startTestApp();
    const teacher = await runActivity(app, 'single-example', [
      { group: 2, question: 1, answers: ['CPU'] },
      { group: 1, question: 1, answers: ['GPU'] },
      { group: 1, question: 5, answers: ['堆疊'] },
    ]);
    const before = app.gateway.get('single-example');
    if (before === undefined) throw new Error('缺少文件');

    const res = await call(app, 'POST', '/api/session/export', teacher);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ writtenQuestionCount: 2, writtenCellCount: 2 });
    const after = app.gateway.get('single-example');
    if (after === undefined) throw new Error('缺少文件');
    expect(diffCells(before, after)).toEqual({ '4,6': ['', 'CPU'], '12,6': ['', '堆疊'] });

    expect((await call(app, 'POST', '/api/session/export', teacher)).statusCode).toBe(200);
    expect(app.gateway.get('single-example')).toEqual(after);
  });

  it('題組範例：子題保留「（n）」標記，答案接在後面', async () => {
    app = await startTestApp();
    const teacher = await runActivity(app, 'group-example', [
      { group: 1, question: 1, answers: ['CPU', '作業系統'] },
      { group: 2, question: 3, answers: ['0'] },
    ]);
    const before = app.gateway.get('group-example');
    if (before === undefined) throw new Error('缺少文件');
    const res = await call(app, 'POST', '/api/session/export', teacher);
    expect(res.json()).toMatchObject({ writtenQuestionCount: 2, writtenCellCount: 3 });
    const after = app.gateway.get('group-example');
    if (after === undefined) throw new Error('缺少文件');
    expect(diffCells(before, after)).toEqual({
      '4,6': ['（1）', '（1）CPU'],
      '5,6': ['（2）', '（2）作業系統'],
      '10,6': ['', '0'],
    });
  });

  it('匯出後老師即時收到 lastExport', async () => {
    app = await startTestApp();
    const teacher = await runActivity(app, 'single-example', [
      { group: 1, question: 2, answers: ['0'] },
    ]);
    const watcher = await connectSocket(app.url, teacher);
    sockets.push(watcher);
    await call(app, 'POST', '/api/session/export', teacher);
    const pushed = await watcher.nextState(
      (p) => p.view.viewer === 'teacher' && p.view.lastExport !== null,
    );
    expect(pushed.view).toMatchObject({ lastExport: { writtenQuestionCount: 1 } });
  });

  it('文件被改到無法定位時回 422 EXPORT_LOCATE_FAILED，且沒有任何寫入', async () => {
    app = await startTestApp();
    const teacher = await runActivity(app, 'group-example', [
      { group: 1, question: 1, answers: ['CPU', 'OS'] },
      { group: 2, question: 3, answers: ['0'] },
    ]);
    const doc = app.gateway.get('group-example');
    const sheet = doc?.sheets[0];
    if (doc === undefined || sheet === undefined) throw new Error('缺少文件');
    sheet.cells.splice(10, 1); // 刪掉第 3 題的列
    app.gateway.set('group-example', doc);

    const res = await call(app, 'POST', '/api/session/export', teacher);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      error: { code: 'EXPORT_LOCATE_FAILED', details: [{ questionNumber: 3 }] },
    });
    expect(app.gateway.writeLog).toHaveLength(0);
    expect(app.service.getSession().lastExport).toBeNull();
  });

  it('非已結束時回 409；文件無法存取時回 502；學生 token 回 403', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    const notClosed = await call(app, 'POST', '/api/session/export', teacher);
    expect(notClosed.statusCode).toBe(409);
    expect(notClosed.json()).toMatchObject({ error: { code: 'INVALID_TRANSITION' } });

    const student = await joinStudent(app, 1);
    expect((await call(app, 'POST', '/api/session/export', student)).statusCode).toBe(403);

    await call(app, 'POST', '/api/session/open', teacher);
    await call(app, 'POST', '/api/session/close', teacher);
    app.gateway.failNext = true;
    const unavailable = await call(app, 'POST', '/api/session/export', teacher);
    expect(unavailable.statusCode).toBe(502);
    expect(unavailable.json()).toMatchObject({ error: { code: 'SHEETS_UNAVAILABLE' } });
  });

  it('沒有任何搶答成功時寫入 0 題、0 格', async () => {
    app = await startTestApp();
    const teacher = await runActivity(app, 'single-example', []);
    const res = await call(app, 'POST', '/api/session/export', teacher);
    expect(res.json()).toMatchObject({ writtenQuestionCount: 0, writtenCellCount: 0 });
    expect(app.gateway.writeLog).toHaveLength(0);
  });

  it('已結束、已匯出後重啟伺服器：lastExport 與結果不變，且可再次匯出（SC-010）', async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'crs-export-restart-'));
    app = await startTestApp({ repository: new LocalSessionRepository(dataDir) });
    const teacher = await runActivity(app, 'single-example', [
      { group: 1, question: 3, answers: ['IP'] },
    ]);
    await call(app, 'POST', '/api/session/export', teacher);
    const before = structuredClone(app.service.getSession());
    expect(before.lastExport).not.toBeNull();

    app = await restartApp(app, dataDir);
    expect(app.service.getSession()).toEqual(before);
    const again = await call(app, 'POST', '/api/session/export', teacher);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ writtenQuestionCount: 1 });
  });
});
