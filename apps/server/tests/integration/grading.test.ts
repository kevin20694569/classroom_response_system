import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SessionStatePayload, StudentView } from '@crs/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalSessionRepository } from '../../src/infrastructure/persistence/localSessionRepository.js';
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

/**
 * 老師批改（004 US6、FR-031～FR-036、SC-011）：權限、階段、即時推播、可見性、保存與匯出。
 */
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

const studentView = (p: SessionStatePayload): StudentView => {
  if (p.view.viewer !== 'student') throw new Error('應為學生檢視');
  return p.view;
};

/** 第 1 組先送出第 3 題（答錯）、第 2 組後送出（答對），然後結束搶答。 */
async function closedActivity(a: TestApp) {
  const teacher = await teacherWithImport(a, 'group-example', 2);
  await call(a, 'POST', '/api/session/open', teacher);
  const g1 = await joinStudent(a, 1, 'Milo');
  const g2 = await joinStudent(a, 2, 'Leo');
  expect((await submitAnswers(a, g1, 3, ['第一組的錯答'])).statusCode).toBe(200);
  expect((await submitAnswers(a, g2, 3, ['0'])).statusCode).toBe(200);
  await call(a, 'POST', '/api/session/close', teacher);
  const [first, second] = a.service.getSession().submissions;
  if (first === undefined || second === undefined) throw new Error('缺少送出紀錄');
  return { teacher, g1, g2, first, second };
}

const grade = (a: TestApp, token: string | null, submissionId: string, correct: boolean) =>
  call(a, 'POST', '/api/session/grade', token, { submissionId, correct });

describe('老師批改', () => {
  it('只有老師能批改；只在「已結束」接受；找不到送出回 404', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'group-example', 2);
    await call(app, 'POST', '/api/session/open', teacher);
    const g1 = await joinStudent(app, 1);
    await submitAnswers(app, g1, 3, ['0']);
    const id = app.service.getSession().submissions[0]?.id ?? '';

    const whileOpen = await grade(app, teacher, id, true);
    expect(whileOpen.statusCode).toBe(409);
    expect(whileOpen.json()).toEqual({
      error: { code: 'GRADE_NOT_ALLOWED', message: '搶答結束後才能批改。' },
    });
    expect((await call(app, 'POST', '/api/session/grade/finish', teacher, {})).statusCode).toBe(
      409,
    );

    await call(app, 'POST', '/api/session/close', teacher);
    expect((await grade(app, g1, id, true)).statusCode).toBe(403);
    expect((await grade(app, null, id, true)).statusCode).toBe(401);
    expect((await call(app, 'POST', '/api/session/grade/finish', g1, {})).statusCode).toBe(403);
    const missing = await grade(app, teacher, '0b8d2c33-5f0e-4d0a-9a8e-2f2b1f1d0c11', true);
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: 'SUBMISSION_NOT_FOUND' } });
    const extra = await call(app, 'POST', '/api/session/grade', teacher, {
      submissionId: id,
      correct: true,
      groupId: 1,
    });
    expect(extra.statusCode).toBe(400);

    const ok = await grade(app, teacher, id, true);
    expect(ok.statusCode).toBe(200);
    expect(app.service.getSession().submissions[0]?.correct).toBe(true);
  });

  it('勾選即時通知該組「答對」，取消勾選回到等待批改；批改完成前不公布他組答案（FR-025、FR-033）', async () => {
    app = await startTestApp();
    const { teacher, g1, g2, first, second } = await closedActivity(app);
    const [s1, s2] = await Promise.all([connectSocket(app.url, g1), connectSocket(app.url, g2)]);
    sockets.push(s1, s2);
    expect(studentView(s2.states[0] as SessionStatePayload).ownSubmissions[0]?.grading).toBe(
      'PENDING',
    );

    const correct = s2.nextState(
      (p) => studentView(p).ownSubmissions[0]?.grading === 'CORRECT',
      1000,
    );
    expect((await grade(app, teacher, second.id, true)).statusCode).toBe(200);
    await correct;
    const back = s2.nextState((p) => studentView(p).ownSubmissions[0]?.grading === 'PENDING', 1000);
    await grade(app, teacher, second.id, false);
    await back;
    await grade(app, teacher, second.id, true);

    // 批改完成前，第 1 組收到的所有資料都不含第 2 組的答案與送出者
    await new Promise((resolve) => setTimeout(resolve, 100));
    const beforeFinish = [
      (await call(app, 'GET', '/api/session', g1)).body,
      ...s1.states.map((p) => JSON.stringify(p)),
    ].join('\n');
    expect(beforeFinish).not.toContain('Leo');
    expect(beforeFinish).not.toContain('"0"');
    expect(studentView(s1.states.at(-1) as SessionStatePayload).results).toBeNull();
    expect(first.correct).toBe(false);
  });

  it('批改完成後：未勾選為答錯；搶答成功為答對中最早送出；之後仍可修改勾選（FR-032、FR-034）', async () => {
    app = await startTestApp();
    const { teacher, g1, first, second } = await closedActivity(app);
    await grade(app, teacher, second.id, true);
    const s1 = await connectSocket(app.url, g1);
    sockets.push(s1);

    const finished = s1.nextState((p) => studentView(p).gradingFinished, 1000);
    expect((await call(app, 'POST', '/api/session/grade/finish', teacher, {})).statusCode).toBe(
      200,
    );
    const view = studentView(await finished);
    expect(view.ownSubmissions[0]?.grading).toBe('INCORRECT');
    expect(view.results?.find((r) => r.questionNumber === 3)).toMatchObject({
      winnerGroupId: 2,
      submitterNickname: 'Leo',
    });
    const finishedAt = app.service.getSession().gradingFinishedAt;
    expect(finishedAt).not.toBeNull();
    await call(app, 'POST', '/api/session/grade/finish', teacher, {});
    expect(app.service.getSession().gradingFinishedAt).toBe(finishedAt);

    // 批改完成後再勾選第 1 組：第 1 組較早送出，成為搶答成功
    const regraded = s1.nextState(
      (p) => studentView(p).results?.find((r) => r.questionNumber === 3)?.winnerGroupId === 1,
      1000,
    );
    await grade(app, teacher, first.id, true);
    expect(studentView(await regraded).ownSubmissions[0]?.grading).toBe('CORRECT');
  });

  it('勾選與批改完成在伺服器重新啟動後保留；重新匯入時清空（FR-035）', async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'crs-grading-'));
    app = await startTestApp({ repository: new LocalSessionRepository(dataDir) });
    const { teacher, second } = await closedActivity(app);
    await grade(app, teacher, second.id, true);
    await call(app, 'POST', '/api/session/grade/finish', teacher, {});
    app = await restartApp(app, dataDir);
    const session = app.service.getSession();
    expect(session.submissions.find((s) => s.id === second.id)?.correct).toBe(true);
    expect(session.gradingFinishedAt).not.toBeNull();

    const reimport = await call(app, 'POST', '/api/session/import', teacher, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/group-example/edit',
      groupCount: 2,
      confirmDiscard: true,
    });
    expect(reimport.statusCode).toBe(200);
    expect(app.service.getSession().gradingFinishedAt).toBeNull();
    expect(app.service.getSession().submissions).toHaveLength(0);
  });

  it('批改的 log 不含暱稱（FR-036）', async () => {
    app = await startTestApp();
    const { teacher, second } = await closedActivity(app);
    await grade(app, teacher, second.id, true);
    await call(app, 'POST', '/api/session/grade/finish', teacher, {});
    const logs = app.logLines.join('\n');
    expect(logs).toContain('submission.graded');
    expect(logs).toContain('grading.finished');
    expect(logs).not.toContain('Leo');
    expect(logs).not.toContain('Milo');
  });

  it('匯出依批改結果：寫入答對中最早送出的答案；沒有勾選的題目不寫入（FR-027）', async () => {
    app = await startTestApp();
    const { teacher, second } = await closedActivity(app);
    const none = await call(app, 'POST', '/api/session/export', teacher, {
      mode: 'answers-with-note-line',
    });
    expect(none.json()).toMatchObject({ writtenQuestionCount: 0, writtenCellCount: 0 });

    await grade(app, teacher, second.id, true);
    const res = await call(app, 'POST', '/api/session/export', teacher, {
      mode: 'answers-with-note-line',
    });
    expect(res.json()).toMatchObject({ writtenQuestionCount: 1 });
    const cells = app.gateway.get('group-example')?.sheets[0]?.cells ?? [];
    expect(cells[10]?.[6]).toMatch(/^0\n〔第 2 組｜Leo｜.+〕$/);
    expect(JSON.stringify(cells)).not.toContain('第一組的錯答');
  });
});
