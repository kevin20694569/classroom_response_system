import { describe, expect, it } from 'vitest';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import { deriveResults } from '../../src/domain/ranking/results.js';
import { readySession, submission } from '../helpers/builders.js';

describe('FirstSubmissionStrategy', () => {
  it('只依 sequence 排序，不依 receivedAt', () => {
    const late = { ...submission(1, 1, 2), receivedAt: '2026-01-01T00:00:00.000Z' };
    const early = { ...submission(1, 2, 1), receivedAt: '2027-01-01T00:00:00.000Z' };
    const ranked = new FirstSubmissionStrategy().rank([late, early]);
    expect(ranked.map((s) => s.groupId)).toEqual([2, 1]);
  });
});

describe('deriveResults', () => {
  it('每題第一名為搶答成功，沒有作答為 null', () => {
    const session = readySession({
      status: 'OPEN',
      submissions: [submission(1, 2, 3), submission(1, 1, 5), submission(2, 1, 4)],
      nextSequence: 6,
    });
    const results = deriveResults(session, new FirstSubmissionStrategy());
    expect(results).toHaveLength(3);
    expect(results[0]?.winner?.groupId).toBe(2);
    expect(results[1]?.winner?.groupId).toBe(1);
    expect(results[2]?.winner).toBeNull();
  });
});
