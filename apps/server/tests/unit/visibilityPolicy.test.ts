import { describe, expect, it } from 'vitest';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import { GroupRoster } from '../../src/domain/roster/groupRoster.js';
import {
  toPublicView,
  toStudentView,
  toTeacherView,
} from '../../src/domain/visibility/visibilityPolicy.js';
import { readySession, submission } from '../helpers/builders.js';

const strategy = new FirstSubmissionStrategy();
const roster = new GroupRoster();
const NOW = new Date('2026-11-25T02:00:00.000Z');
const openSession = readySession({
  status: 'OPEN',
  submissions: [
    submission(1, 1, 1, ['第一組的秘密答案']),
    submission(1, 2, 2, ['第二組的秘密答案']),
  ],
  nextSequence: 3,
});

describe('VisibilityPolicy', () => {
  it('未登入檢視只有狀態、組別與題號', () => {
    const view = toPublicView(openSession, roster);
    expect(view.viewer).toBe('public');
    expect(JSON.stringify(view)).not.toContain('秘密答案');
    expect(view.questions.map((q) => q.blankCount)).toEqual([1, 1, 2]);
  });

  it('結束前學生只看到自己組別的答案，沒有 sequence、順位或結果', () => {
    const view = toStudentView(openSession, 2, strategy, roster, NOW);
    const json = JSON.stringify(view);
    expect(json).toContain('第二組的秘密答案');
    expect(json).not.toContain('第一組的秘密答案');
    expect(json).not.toContain('sequence');
    expect(json).not.toContain('winnerGroupId');
    expect(view.results).toBeNull();
  });

  it('結束後學生看得到每題結果', () => {
    const view = toStudentView({ ...openSession, status: 'CLOSED' }, 2, strategy, roster, NOW);
    expect(view.results?.[0]?.winnerGroupId).toBe(1);
  });

  it('老師看得到所有作答與目前第一名', () => {
    const view = toTeacherView(openSession, strategy, new Date());
    expect(view.submissions).toHaveLength(2);
    expect(view.results[0]?.winnerGroupId).toBe(1);
    expect(view.results[1]?.winnerGroupId).toBeNull();
  });

  it('老師檢視含題目敘述、子題、結果提交時間與 serverNow（002）', () => {
    const now = new Date('2026-11-23T02:10:00.000Z');
    const closed = { ...openSession, status: 'CLOSED' as const };
    const view = toTeacherView(closed, strategy, now);
    expect(view.serverNow).toBe(now.toISOString());
    expect(view.questions[0]).toMatchObject({ number: 1, prompt: '第 1 題的敘述', blankCount: 1 });
    expect(view.questions[2]?.blanks).toEqual([
      { index: 1, label: '（1）', prompt: '第 3 題子題一的敘述' },
      { index: 2, label: '（2）', prompt: '第 3 題子題二的敘述' },
    ]);
    expect(JSON.stringify(view.questions)).not.toContain('location');
    const winner = closed.submissions.find((s) => s.groupId === 1);
    expect(view.results[0]?.receivedAt).toBe(winner?.receivedAt);
    // 無人搶答的題目沒有提交時間
    expect(view.results[1]?.receivedAt).toBeNull();
  });

  it('公開檢視任何階段都不含題目敘述（004 FR-018、FR-019）', () => {
    for (const status of ['READY', 'OPEN', 'CLOSED'] as const) {
      const json = JSON.stringify(toPublicView({ ...openSession, status }, roster));
      expect(json).not.toContain('敘述');
      expect(json).not.toContain('prompt');
      expect(json).not.toContain('content');
    }
  });

  it('學生檢視在「待開始」以前每題 content 為 null，資料不含任何敘述（004 FR-018）', () => {
    for (const status of ['NOT_IMPORTED', 'READY'] as const) {
      const view = toStudentView({ ...openSession, status }, 1, strategy, roster, NOW);
      for (const q of view.questions) expect(q.content).toBeNull();
      expect(JSON.stringify(view)).not.toContain('敘述');
    }
  });

  it('學生檢視在「搶答進行中」「已結束」有題目敘述，與匯入的題目相同（004 FR-016）', () => {
    for (const status of ['OPEN', 'CLOSED'] as const) {
      const view = toStudentView({ ...openSession, status }, 1, strategy, roster, NOW);
      expect(view.questions[0]?.content).toEqual({ prompt: '第 1 題的敘述', blankPrompts: [null] });
      expect(view.questions[2]?.content).toEqual({
        prompt: openSession.questions[2]?.prompt ?? null,
        blankPrompts: ['第 3 題子題一的敘述', '第 3 題子題二的敘述'],
      });
    }
  });

  it('三種檢視的題目都有子題標記原文，公開資料不含敘述（003 FR-012、004 FR-019）', () => {
    const closed = { ...openSession, status: 'CLOSED' as const };
    const views = [
      toPublicView(closed, roster),
      toStudentView(closed, 1, strategy, roster, NOW),
      toTeacherView(closed, strategy, new Date()),
    ];
    for (const view of views) {
      expect(view.questions.map((q) => q.blankLabels)).toEqual([
        [null],
        [null],
        ['（1）', '（2）'],
      ]);
    }
    // 公開檢視不含敘述；學生檢視在已結束時才有敘述（004）
    expect(JSON.stringify(views[0])).not.toContain('敘述');
  });
});

describe('VisibilityPolicy — 004 人數與本組成員（FR-009、FR-010、FR-014）', () => {
  const withMembers = new GroupRoster();
  withMembers.connected('a1', 1, '第一組的小明');
  withMembers.connected('a2', 1, 'Ava');
  withMembers.connected('b1', 2, 'Leo');

  it('公開檢視有各組人數，沒有任何成員名單', () => {
    const view = toPublicView(openSession, withMembers);
    expect(view.headcounts).toEqual([
      { groupId: 1, memberCount: 2 },
      { groupId: 2, memberCount: 1 },
    ]);
    expect(JSON.stringify(view)).not.toContain('小明');
    expect(JSON.stringify(view)).not.toContain('Leo');
  });

  it('學生檢視有各組人數與只有本組的成員名單', () => {
    const view = toStudentView(openSession, 2, strategy, withMembers, NOW);
    expect(view.headcounts.map((h) => h.memberCount)).toEqual([2, 1]);
    expect(view.members).toEqual([{ memberId: 'b1', nickname: 'Leo' }]);
    expect(JSON.stringify(view)).not.toContain('第一組的小明');
  });

  it('老師檢視不含人數與成員名單', () => {
    const view = toTeacherView(openSession, strategy, new Date());
    expect(Object.keys(view)).not.toContain('headcounts');
    expect(Object.keys(view)).not.toContain('members');
  });
});

describe('VisibilityPolicy — 004 搶答計時（FR-029、FR-030）', () => {
  it('學生檢視含開啟、結束與伺服器時間', () => {
    const session = readySession({
      status: 'CLOSED',
      openedAt: '2026-11-25T01:00:00.000Z',
      closedAt: '2026-11-25T01:05:00.000Z',
    });
    const view = toStudentView(session, 1, strategy, roster, NOW);
    expect(view).toMatchObject({
      openedAt: '2026-11-25T01:00:00.000Z',
      closedAt: '2026-11-25T01:05:00.000Z',
      serverNow: NOW.toISOString(),
    });
  });
});
