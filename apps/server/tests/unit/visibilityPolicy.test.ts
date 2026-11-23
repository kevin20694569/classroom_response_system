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
    const view = toTeacherView(openSession, strategy);
    expect(view.submissions).toHaveLength(2);
    expect(view.results[0]?.winnerGroupId).toBe(1);
    expect(view.results[1]?.winnerGroupId).toBeNull();
  });
});
