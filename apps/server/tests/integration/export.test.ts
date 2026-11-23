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

  it('題組範例（真實版面）：答案寫入 H 欄，G 欄標記不動（002 FR-025）', async () => {
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
      '4,7': ['', 'CPU'],
      '5,7': ['', '作業系統'],
      '10,6': ['', '0'],
    });
  });

  it('標記與答案同格的版面：子題保留「（n）」標記，答案接在後面（同 001）', async () => {
    app = await startTestApp();
    const teacher = await runActivity(app, 'marker-in-answer-cell', [
      { group: 1, question: 1, answers: ['CPU', '作業系統'] },
    ]);
    const before = app.gateway.get('marker-in-answer-cell');
    if (before === undefined) throw new Error('缺少文件');
    expect((await call(app, 'POST', '/api/session/export', teacher)).statusCode).toBe(200);
    const after = app.gateway.get('marker-in-answer-cell');
    if (after === undefined) throw new Error('缺少文件');
    expect(diffCells(before, after)).toEqual({
      '4,6': ['（1）', '（1）CPU'],
      '5,6': ['（2）', '（2）作業系統'],
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

const TIME_PATTERN = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/;

describe('匯出模式（002 US4）', () => {
  async function groupActivity(a: TestApp): Promise<string> {
    return runActivity(a, 'group-example', [
      { group: 2, question: 1, answers: ['CPU', '作業系統'] },
      { group: 1, question: 3, answers: ['0'] },
    ]);
  }
  const exportWith = (a: TestApp, teacher: string, payload: object) =>
    call(a, 'POST', '/api/session/export', teacher, payload);
  const cells = (a: TestApp) => a.gateway.get('group-example')?.sheets[0]?.cells ?? [];

  it('{} 等同「只有答案」：只有填答格寫入答案', async () => {
    app = await startTestApp();
    const teacher = await groupActivity(app);
    const before = app.gateway.get('group-example');
    if (before === undefined) throw new Error('缺少文件');
    const res = await exportWith(app, teacher, {});
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mode: 'answers-only', writtenQuestionCount: 2 });
    const after = app.gateway.get('group-example');
    if (after === undefined) throw new Error('缺少文件');
    expect(diffCells(before, after)).toEqual({
      '4,7': ['', 'CPU'],
      '5,7': ['', '作業系統'],
      '10,6': ['', '0'],
    });
  });

  it('mode 不正確或含多餘欄位時回 400「匯出模式不正確」，且沒有讀寫文件', async () => {
    app = await startTestApp();
    const teacher = await groupActivity(app);
    const reads = app.gateway.readCount;
    for (const payload of [{ mode: 'unknown' }, { mode: 'answers-only', extra: true }]) {
      const res = await exportWith(app, teacher, payload);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: { code: 'VALIDATION_FAILED', message: '匯出模式不正確。' },
      });
    }
    expect(app.gateway.readCount).toBe(reads);
    expect(app.gateway.writeLog).toHaveLength(0);
  });

  it('答案＋組別時間欄：新增兩欄、題目區塊第一列寫入結果；重複匯出文件不變', async () => {
    app = await startTestApp();
    const teacher = await groupActivity(app);
    const res = await exportWith(app, teacher, { mode: 'answers-with-columns' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mode: 'answers-with-columns', writtenQuestionCount: 2 });
    const doc = cells(app);
    expect([doc[3]?.[8], doc[3]?.[9]]).toEqual(['搶答組別', '提交時間']);
    expect(doc[4]?.[8]).toBe('第 2 組');
    expect(doc[4]?.[9]).toMatch(TIME_PATTERN);
    expect(doc[10]?.[8]).toBe('第 1 組');
    expect([doc[7]?.[8], doc[12]?.[8]]).toEqual(['', '']);
    expect([doc[4]?.[6], doc[4]?.[7], doc[10]?.[6]]).toEqual(['（1）', 'CPU', '0']);

    const snapshot = app.gateway.get('group-example');
    expect((await exportWith(app, teacher, { mode: 'answers-with-columns' })).statusCode).toBe(200);
    expect(app.gateway.get('group-example')).toEqual(snapshot);
  });

  it('答案＋格內附註行：附註行為淡化樣式；重複匯出不累加；改回只有答案時附註行與樣式消失', async () => {
    app = await startTestApp();
    const teacher = await groupActivity(app);
    expect((await exportWith(app, teacher, { mode: 'answers-with-note-line' })).statusCode).toBe(
      200,
    );
    let doc = cells(app);
    expect([doc[4]?.[6], doc[5]?.[6]]).toEqual(['（1）', '（2）']);
    expect(doc[4]?.[7]).toBe('CPU');
    expect(doc[5]?.[7]).toMatch(/^作業系統\n〔第 2 組｜.+〕$/);
    expect(doc[10]?.[6]).toMatch(/^0\n〔第 1 組｜.+〕$/);
    expect(app.gateway.formatAt('學習單', 5, 7)).toBe('作業系統'.length);
    expect(app.gateway.formatAt('學習單', 4, 7)).toBeNull();

    const snapshot = app.gateway.get('group-example');
    expect((await exportWith(app, teacher, { mode: 'answers-with-note-line' })).statusCode).toBe(
      200,
    );
    expect(app.gateway.get('group-example')).toEqual(snapshot);

    expect((await exportWith(app, teacher, { mode: 'answers-only' })).statusCode).toBe(200);
    doc = cells(app);
    expect([doc[5]?.[7], doc[10]?.[6]]).toEqual(['作業系統', '0']);
    expect(app.gateway.formatAt('學習單', 5, 7)).toBeNull();
  });

  it('欄位模式後改用其他模式：結果欄保留不動', async () => {
    app = await startTestApp();
    const teacher = await groupActivity(app);
    await exportWith(app, teacher, { mode: 'answers-with-columns' });
    const groupCell = cells(app)[4]?.[8];
    await exportWith(app, teacher, { mode: 'answers-with-note-line' });
    expect(cells(app)[3]?.[8]).toBe('搶答組別');
    expect(cells(app)[4]?.[8]).toBe(groupCell);
  });

  it('匯出後的文件重新匯入成功，題數與題組判斷不變（FR-023）', async () => {
    app = await startTestApp();
    const teacher = await groupActivity(app);
    await exportWith(app, teacher, { mode: 'answers-with-columns' });
    await exportWith(app, teacher, { mode: 'answers-with-note-line' });
    const res = await call(app, 'POST', '/api/session/import', teacher, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/group-example/edit',
      groupCount: 2,
      confirmDiscard: true,
    });
    expect(res.statusCode).toBe(200);
    expect(
      res
        .json<{ view: { questions: { kind: string; blankCount: number }[] } }>()
        .view.questions.map((q) => [q.kind, q.blankCount]),
    ).toEqual([
      ['group', 2],
      ['group', 2],
      ['single', 1],
      ['single', 1],
    ]);
  });

  it('刪除題目列後以欄位模式匯出：EXPORT_LOCATE_FAILED，文件沒有任何寫入（含表頭）', async () => {
    app = await startTestApp();
    const teacher = await groupActivity(app);
    const doc = app.gateway.get('group-example');
    if (doc === undefined) throw new Error('缺少文件');
    doc.sheets[0]?.cells.splice(10, 1);
    app.gateway.set('group-example', doc);
    const res = await exportWith(app, teacher, { mode: 'answers-with-columns' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'EXPORT_LOCATE_FAILED' } });
    expect(app.gateway.writeLog).toHaveLength(0);
    expect(app.gateway.get('group-example')).toEqual(doc);
  });

  it('lastExport.mode 經 session:state 推播給老師', async () => {
    app = await startTestApp();
    const teacher = await groupActivity(app);
    const socket = await connectSocket(app.url, teacher);
    sockets.push(socket);
    const pushed = socket.nextState(
      (p) => p.view.viewer === 'teacher' && p.view.lastExport?.mode === 'answers-with-note-line',
      1000,
    );
    await exportWith(app, teacher, { mode: 'answers-with-note-line' });
    await pushed;
  });

  it.each(['answers-only', 'answers-with-columns', 'answers-with-note-line'])(
    '%s：多組作答同一題時只寫入搶答成功（第一名）的答案（002 FR-026）',
    async (mode) => {
      app = await startTestApp();
      const teacher = await runActivity(app, 'group-example', [
        { group: 2, question: 3, answers: ['第一名答案'] },
        { group: 1, question: 3, answers: ['第二名答案'] },
      ]);
      expect((await exportWith(app, teacher, { mode })).statusCode).toBe(200);
      const doc = JSON.stringify(app.gateway.get('group-example'));
      expect(doc).toContain('第一名答案');
      expect(doc).not.toContain('第二名答案');
      if (mode !== 'answers-only') expect(doc).toContain('第 2 組');
    },
  );
});
