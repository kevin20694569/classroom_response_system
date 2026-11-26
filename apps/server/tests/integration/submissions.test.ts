import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

async function openGroupExample(): Promise<{ a: TestApp; teacher: string }> {
  app = await startTestApp();
  const teacher = await teacherWithImport(app, 'group-example', 2);
  await call(app, 'POST', '/api/session/open', teacher);
  return { a: app, teacher };
}

function errorCode(res: { body: string }): string {
  return (JSON.parse(res.body) as { error: { code: string } }).error.code;
}

describe('學生加入（POST /api/auth/student）', () => {
  it('尚未匯入時 NO_ACTIVE_ACTIVITY；組別不存在時 INVALID_GROUP', async () => {
    app = await startTestApp();
    const early = await call(app, 'POST', '/api/auth/student', null, {
      groupId: 1,
      nickname: '測試',
    });
    expect(early.statusCode).toBe(409);
    expect(errorCode(early)).toBe('NO_ACTIVE_ACTIVITY');

    await teacherWithImport(app, 'single-example', 2);
    for (const groupId of [0, 3, 21]) {
      const res = await call(app, 'POST', '/api/auth/student', null, { groupId, nickname: '測試' });
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('INVALID_GROUP');
    }
    const ok = await call(app, 'POST', '/api/auth/student', null, { groupId: 2, nickname: '測試' });
    expect(ok.json()).toMatchObject({ identity: { role: 'student', groupId: 2 } });
  });
});

describe('送出答案（POST /api/submissions）', () => {
  it('單題與題組正常送出', async () => {
    const { a } = await openGroupExample();
    const g1 = await joinStudent(a, 1);
    expect((await submitAnswers(a, g1, 1, ['CPU', '作業系統'])).statusCode).toBe(200);
    expect((await submitAnswers(a, g1, 3, ['0'])).statusCode).toBe(200);
    expect(a.service.getSession().submissions.map((s) => s.sequence)).toEqual([1, 2]);
  });

  it('非搶答進行中回 SESSION_NOT_OPEN（待開始、已結束）', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'group-example', 2);
    const g1 = await joinStudent(app, 1);
    expect(errorCode(await submitAnswers(app, g1, 3, ['0']))).toBe('SESSION_NOT_OPEN');
    await call(app, 'POST', '/api/session/open', teacher);
    await call(app, 'POST', '/api/session/close', teacher);
    expect(errorCode(await submitAnswers(app, g1, 3, ['0']))).toBe('SESSION_NOT_OPEN');
  });

  it('題號不存在、題組缺子題、答案空白或過長都被拒絕，且不消耗 sequence', async () => {
    const { a } = await openGroupExample();
    const g1 = await joinStudent(a, 1);
    const missing = await submitAnswers(a, g1, 9, ['x']);
    expect(missing.statusCode).toBe(404);
    expect(errorCode(missing)).toBe('QUESTION_NOT_FOUND');

    expect(errorCode(await submitAnswers(a, g1, 1, ['CPU']))).toBe('ANSWER_INCOMPLETE');

    for (const bad of ['', '   ', '字'.repeat(201)]) {
      const res = await submitAnswers(a, g1, 3, [bad]);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: { code: 'ANSWER_INVALID', details: [{ blankIndex: 1, questionNumber: 3 }] },
      });
    }
    expect(a.service.getSession().submissions).toHaveLength(0);
    expect(a.service.getSession().nextSequence).toBe(1);

    expect((await submitAnswers(a, g1, 3, ['0'])).statusCode).toBe(200);
    expect(a.service.getSession().submissions[0]?.sequence).toBe(1);
  });

  it('同組同題第二次送出回 ALREADY_SUBMITTED', async () => {
    const { a } = await openGroupExample();
    const g1 = await joinStudent(a, 1);
    await submitAnswers(a, g1, 3, ['0']);
    const again = await submitAnswers(a, g1, 3, ['1']);
    expect(again.statusCode).toBe(409);
    expect(errorCode(again)).toBe('ALREADY_SUBMITTED');
  });

  it('請求不能指定組別或時間', async () => {
    const { a } = await openGroupExample();
    const g1 = await joinStudent(a, 1);
    const res = await call(a, 'POST', '/api/submissions', g1, {
      questionNumber: 3,
      groupId: 2,
      answers: [{ blankIndex: 1, text: '0' }],
    });
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_FAILED');
  });

  it('老師即時看到送出紀錄與目前搶答成功組別', async () => {
    const { a, teacher } = await openGroupExample();
    const watcher = await connectSocket(a.url, teacher);
    sockets.push(watcher);
    const g2 = await joinStudent(a, 2);
    await submitAnswers(a, g2, 1, ['CPU', '作業系統']);
    const pushed = await watcher.nextState(
      (p) => p.view.viewer === 'teacher' && p.view.submissions.length === 1,
    );
    if (pushed.view.viewer !== 'teacher') throw new Error('應為老師檢視');
    expect(pushed.view.submissions[0]).toMatchObject({ groupId: 2, sequence: 1 });
    expect(pushed.view.results[0]).toMatchObject({ questionNumber: 1, winnerGroupId: 2 });
  });
});

describe('重新匯入使學生身分失效（spec 邊界案例）', () => {
  it('已結束後匯入新文件：舊學生 token 401、收到 session:reset', async () => {
    const { a, teacher } = await openGroupExample();
    const g1 = await joinStudent(a, 1);
    const s1 = await connectSocket(a.url, g1);
    sockets.push(s1);
    await call(a, 'POST', '/api/session/close', teacher);
    await call(a, 'POST', '/api/session/import', teacher, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/group-example/edit',
      groupCount: 2,
      confirmDiscard: true,
    });
    await expect.poll(() => s1.resets.length).toBe(1);
    expect((await call(a, 'GET', '/api/session', g1)).statusCode).toBe(401);
  });

  it('待開始重新匯入：舊學生 token 401、收到 session:reset、連線中斷、收不到新活動狀態', async () => {
    app = await startTestApp();
    const teacher = await teacherWithImport(app, 'single-example', 2);
    const g1 = await joinStudent(app, 1);
    const s1 = await connectSocket(app.url, g1);
    sockets.push(s1);
    const statesBefore = s1.states.length;
    await call(app, 'POST', '/api/session/import', teacher, {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-example/edit',
      groupCount: 3,
    });
    await expect.poll(() => s1.resets.length).toBe(1);
    await expect.poll(() => s1.socket.connected).toBe(false);
    expect(s1.states.length).toBe(statesBefore);
    expect((await call(app, 'GET', '/api/session', g1)).statusCode).toBe(401);
    await expect(connectSocket(app.url, g1)).rejects.toThrow('UNAUTHORIZED');
  });
});

describe('有作答紀錄時重啟伺服器（SC-010）', () => {
  it('作答紀錄、sequence、搶答成功組別不變，下一筆送出的 sequence 接續編號', async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'crs-sub-restart-'));
    app = await startTestApp({ repository: new LocalSessionRepository(dataDir) });
    const teacher = await teacherWithImport(app, 'group-example', 2);
    await call(app, 'POST', '/api/session/open', teacher);
    const [g1, g2] = await Promise.all([joinStudent(app, 1), joinStudent(app, 2)]);
    await submitAnswers(app, g2, 3, ['0']);
    await submitAnswers(app, g1, 3, ['1']);
    const before = structuredClone(app.service.getSession());

    app = await restartApp(app, dataDir);
    expect(app.service.getSession()).toEqual(before);
    const view = await call(app, 'GET', '/api/session', teacher);
    expect(view.json()).toMatchObject({
      view: { results: [{}, {}, { questionNumber: 3, winnerGroupId: 2 }, {}] },
    });
    expect((await submitAnswers(app, g1, 4, ['IP'])).statusCode).toBe(200);
    expect(app.service.getSession().submissions.at(-1)?.sequence).toBe(3);
  });
});

describe('004：送出者暱稱（FR-023）', () => {
  it('送出紀錄的送出者為 token 的暱稱；log 不含暱稱', async () => {
    const { a } = await openGroupExample();
    const token = await joinStudent(a, 1, '送出者小明');
    expect((await submitAnswers(a, token, 3, ['0'])).statusCode).toBe(200);
    expect(a.service.getSession().submissions.at(-1)?.submitterNickname).toBe('送出者小明');
    const logs = a.logLines.join('\n');
    expect(logs).toContain('submission.accepted');
    expect(logs).not.toContain('送出者小明');
  });

  it('請求附帶名字欄位時回 400，不產生紀錄', async () => {
    const { a } = await openGroupExample();
    const token = await joinStudent(a, 1, 'Milo');
    const res = await call(a, 'POST', '/api/submissions', token, {
      questionNumber: 3,
      answers: [{ blankIndex: 1, text: '0' }],
      nickname: '冒名',
    });
    expect(res.statusCode).toBe(400);
    expect(a.service.getSession().submissions).toHaveLength(0);
  });

  it('被拒絕的送出不產生紀錄，也不記錄送出者', async () => {
    const { a } = await openGroupExample();
    const first = await joinStudent(a, 1, '先送的人');
    const second = await joinStudent(a, 1, '後送的人');
    expect((await submitAnswers(a, first, 3, ['0'])).statusCode).toBe(200);
    expect((await submitAnswers(a, second, 3, ['1'])).statusCode).toBe(409);
    const submissions = a.service.getSession().submissions;
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.submitterNickname).toBe('先送的人');
  });

  it('伺服器重新啟動後送出者仍保留', async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'crs-submitter-'));
    app = await startTestApp({ repository: new LocalSessionRepository(dataDir) });
    const teacher = await teacherWithImport(app, 'group-example', 2);
    await call(app, 'POST', '/api/session/open', teacher);
    const token = await joinStudent(app, 2, 'Leo');
    await submitAnswers(app, token, 3, ['0']);
    app = await restartApp(app, dataDir);
    expect(app.service.getSession().submissions[0]?.submitterNickname).toBe('Leo');
  });
});

describe('006：送出者身分（FR-008、research R1）', () => {
  const memberIdOf = (a: TestApp, token: string): string | undefined => {
    const identity = a.auth.resolve(token, a.service.getSession().activityId);
    return identity?.role === 'student' ? identity.memberId : undefined;
  };

  it('送出紀錄保存 token 的 memberId，老師檢視看得到，學生自己的送出不含此欄位', async () => {
    const { a, teacher } = await openGroupExample();
    const token = await joinStudent(a, 1, 'Milo');
    expect((await submitAnswers(a, token, 3, ['0'])).statusCode).toBe(200);
    const memberId = memberIdOf(a, token);
    expect(memberId).toBeDefined();

    const teacherView = (await call(a, 'GET', '/api/session', teacher)).json<{
      view: { submissions: { submitterMemberId: string | null }[] };
    }>();
    expect(teacherView.view.submissions[0]?.submitterMemberId).toBe(memberId);

    const studentBody = (await call(a, 'GET', '/api/session', token)).body;
    expect(studentBody).not.toContain('submitterMemberId');
  });

  it('請求附帶 submitterMemberId 時回 400，不產生紀錄（身分只能取自 token）', async () => {
    const { a } = await openGroupExample();
    const token = await joinStudent(a, 1, 'Milo');
    const res = await call(a, 'POST', '/api/submissions', token, {
      questionNumber: 3,
      answers: [{ blankIndex: 1, text: '0' }],
      submitterMemberId: '00000000-0000-4000-8000-000000000001',
    });
    expect(res.statusCode).toBe(400);
    expect(a.service.getSession().submissions).toHaveLength(0);
  });

  it('伺服器重新啟動後送出者身分仍保留', async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'crs-submitter-id-'));
    app = await startTestApp({ repository: new LocalSessionRepository(dataDir) });
    const teacher = await teacherWithImport(app, 'group-example', 2);
    await call(app, 'POST', '/api/session/open', teacher);
    const token = await joinStudent(app, 2, 'Leo');
    const memberId = memberIdOf(app, token);
    await submitAnswers(app, token, 3, ['0']);
    app = await restartApp(app, dataDir);
    expect(app.service.getSession().submissions[0]?.submitterMemberId).toBe(memberId);
  });
});
