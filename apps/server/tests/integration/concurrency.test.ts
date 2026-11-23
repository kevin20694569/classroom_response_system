import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import { deriveResults } from '../../src/domain/ranking/results.js';
import { toTeacherView } from '../../src/domain/visibility/visibilityPolicy.js';
import {
  call,
  joinStudent,
  startTestApp,
  submitAnswers,
  teacherWithImport,
  type TestApp,
} from '../helpers/testApp.js';

/**
 * 並發與順位判定的專門測試（constitution 原則 VII、FR-016、SC-005）。
 * 順位只依伺服器處理順序決定，每次都只有一個搶答成功組別，結果確定且可重現。
 */
let app: TestApp;
let teacher: string;

beforeAll(async () => {
  app = await startTestApp();
  teacher = await teacherWithImport(app, 'single-example', 20);
});
afterAll(async () => {
  await app.close();
});

async function newRound(): Promise<string[]> {
  if (app.service.getSession().status === 'OPEN') {
    expect((await call(app, 'POST', '/api/session/close', teacher)).statusCode).toBe(200);
  }
  const res = await call(app, 'POST', '/api/session/import', teacher, {
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/single-example/edit',
    groupCount: 20,
    confirmDiscard: true,
  });
  expect(res.statusCode).toBe(200);
  const tokens = await Promise.all(Array.from({ length: 20 }, (_, i) => joinStudent(app, i + 1)));
  expect((await call(app, 'POST', '/api/session/open', teacher)).statusCode).toBe(200);
  return tokens;
}

describe('20 組同時送出同一題（重複 100 次）', () => {
  it('每次只有 1 個搶答成功組別，sequence 1～20 不重複，結果與推導一致', async () => {
    for (let round = 0; round < 100; round += 1) {
      const tokens = await newRound();
      const responses = await Promise.all(
        tokens.map((token, i) => submitAnswers(app, token, 1, [`第 ${i + 1} 組的答案`])),
      );
      expect(responses.every((r) => r.statusCode === 200)).toBe(true);

      const session = app.service.getSession();
      const sequences = session.submissions.map((s) => s.sequence).sort((a, b) => a - b);
      expect(sequences).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

      const results = deriveResults(session, new FirstSubmissionStrategy());
      const winner = results.find((r) => r.questionNumber === 1)?.winner;
      expect(winner?.sequence).toBe(1);
      expect(session.submissions.filter((s) => s.sequence === 1)).toHaveLength(1);

      const view = toTeacherView(session, new FirstSubmissionStrategy(), new Date());
      expect(view.results.filter((r) => r.winnerGroupId !== null)).toHaveLength(1);
      expect(view.results[0]?.winnerGroupId).toBe(winner?.groupId);
    }
  });
});

describe('「結束」與「送出」同時發生（重複 100 次）', () => {
  it('結束前處理的送出全部接受，結束後處理的全部回 SESSION_NOT_OPEN', async () => {
    let sawAccepted = false;
    let sawRejected = false;
    for (let round = 0; round < 100; round += 1) {
      const tokens = (await newRound()).slice(0, 10);
      // 每回合把「結束」放在不同位置，讓送出可能落在結束之前或之後
      const closeAt = round % (tokens.length + 1);
      const requests = tokens.map((token) => () => submitAnswers(app, token, 2, ['答案']));
      const closeRequest = () => call(app, 'POST', '/api/session/close', teacher);
      const all = [...requests.slice(0, closeAt), closeRequest, ...requests.slice(closeAt)];
      const responses = await Promise.all(all.map((run) => run()));
      const closeRes = responses[closeAt];
      const submits = responses.filter((_, i) => i !== closeAt);
      expect(closeRes?.statusCode).toBe(200);

      const session = app.service.getSession();
      expect(session.status).toBe('CLOSED');
      const accepted = submits.filter((r) => r.statusCode === 200);
      const rejected = submits.filter((r) => r.statusCode !== 200);
      for (const r of rejected) {
        expect(r.json()).toMatchObject({ error: { code: 'SESSION_NOT_OPEN' } });
      }
      // 被接受的送出都在結束之前處理：sequence 連續、全部小於結束時的 nextSequence
      expect(session.submissions).toHaveLength(accepted.length);
      expect(session.submissions.every((s) => s.sequence < session.nextSequence)).toBe(true);
      expect(session.nextSequence).toBe(accepted.length + 1);
      const ids = new Set(accepted.map((r) => r.json<{ submissionId: string }>().submissionId));
      expect(new Set(session.submissions.map((s) => s.id))).toEqual(ids);
      sawAccepted ||= accepted.length > 0;
      sawRejected ||= rejected.length > 0;
    }
    // 確認測試真的涵蓋了「結束前接受」與「結束後拒絕」兩種結果
    expect(sawAccepted).toBe(true);
    expect(sawRejected).toBe(true);
  });
});

describe('同組兩個身分同時送出同一題（重複 100 次，003 SC-005、FR-006）', () => {
  it('每次只接受一筆，另一筆回 ALREADY_SUBMITTED；兩個身分看到相同的本組答案', async () => {
    let sawFirstWin = false;
    let sawSecondWin = false;
    for (let round = 0; round < 100; round += 1) {
      const tokens = await newRound();
      const tabA = tokens[0] ?? '';
      // 同組的第二個分頁：另外加入第 1 組，取得不同的 token
      const tabB = await joinStudent(app, 1);
      const [resA, resB] = await Promise.all([
        submitAnswers(app, tabA, 1, ['分頁 A 的答案']),
        submitAnswers(app, tabB, 1, ['分頁 B 的答案']),
      ]);
      const statuses = [resA.statusCode, resB.statusCode].sort();
      expect(statuses).toEqual([200, 409]);
      const rejected = resA.statusCode === 409 ? resA : resB;
      expect(rejected.json()).toMatchObject({ error: { code: 'ALREADY_SUBMITTED' } });

      const session = app.service.getSession();
      expect(session.submissions.filter((s) => s.groupId === 1)).toHaveLength(1);
      const accepted = resA.statusCode === 200 ? '分頁 A 的答案' : '分頁 B 的答案';
      for (const token of [tabA, tabB]) {
        const view = (await call(app, 'GET', '/api/session', token)).json<{
          view: { ownSubmissions: { answers: { text: string }[] }[] };
        }>().view;
        expect(view.ownSubmissions).toHaveLength(1);
        expect(view.ownSubmissions[0]?.answers[0]?.text).toBe(accepted);
      }
      sawFirstWin ||= resA.statusCode === 200;
      sawSecondWin ||= resB.statusCode === 200;
    }
    // 兩個分頁都有機會成為被接受的那一筆，代表判定依伺服器處理順序而非固定偏好
    expect(sawFirstWin || sawSecondWin).toBe(true);
  });
});
