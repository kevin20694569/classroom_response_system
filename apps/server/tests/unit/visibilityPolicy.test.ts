import { describe, expect, it } from 'vitest';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import {
  toPublicView,
  toStudentView,
  toTeacherView,
} from '../../src/domain/visibility/visibilityPolicy.js';
import { readySession, submission } from '../helpers/builders.js';

const strategy = new FirstSubmissionStrategy();
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
    const view = toPublicView(openSession);
    expect(view.viewer).toBe('public');
    expect(JSON.stringify(view)).not.toContain('秘密答案');
    expect(view.questions.map((q) => q.blankCount)).toEqual([1, 1, 2]);
  });

  it('結束前學生只看到自己組別的答案，沒有 sequence、順位或結果', () => {
    const view = toStudentView(openSession, 2, strategy);
    const json = JSON.stringify(view);
    expect(json).toContain('第二組的秘密答案');
    expect(json).not.toContain('第一組的秘密答案');
    expect(json).not.toContain('sequence');
    expect(json).not.toContain('winnerGroupId');
    expect(view.results).toBeNull();
  });

  it('結束後學生看得到每題結果', () => {
    const view = toStudentView({ ...openSession, status: 'CLOSED' }, 2, strategy);
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

  it('學生與公開檢視不含任何題目敘述（SC-009）', () => {
    for (const status of ['OPEN', 'CLOSED'] as const) {
      const session = { ...openSession, status };
      for (const view of [toPublicView(session), toStudentView(session, 1, strategy)]) {
        const json = JSON.stringify(view);
        expect(json).not.toContain('敘述');
        expect(json).not.toContain('prompt');
      }
    }
  });

  it('三種檢視的題目都有子題標記原文，學生資料不含敘述（003 FR-012、FR-022、SC-004）', () => {
    const closed = { ...openSession, status: 'CLOSED' as const };
    const views = [
      toPublicView(closed),
      toStudentView(closed, 1, strategy),
      toTeacherView(closed, strategy, new Date()),
    ];
    for (const view of views) {
      expect(view.questions.map((q) => q.blankLabels)).toEqual([
        [null],
        [null],
        ['（1）', '（2）'],
      ]);
    }
    for (const view of views.slice(0, 2)) {
      expect(JSON.stringify(view)).not.toContain('敘述');
    }
  });
});
