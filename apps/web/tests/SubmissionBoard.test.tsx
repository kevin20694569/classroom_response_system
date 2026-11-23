import type { Submission } from '@crs/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubmissionBoard } from '../src/pages/teacher/SubmissionBoard';
import { teacherView } from './viewBuilders';

function record(
  questionNumber: number,
  groupId: number,
  sequence: number,
  texts: string[],
): Submission {
  return {
    id: `00000000-0000-4000-8000-00000000000${sequence}`,
    questionNumber,
    groupId,
    answers: texts.map((text, i) => ({ blankIndex: i + 1, text })),
    sequence,
    receivedAt: '2026-11-23T08:00:00.000Z',
  };
}

describe('SubmissionBoard（US3）', () => {
  it('搶答進行中依順位列出送出紀錄，第一位標示搶答成功，題組依子題分列', () => {
    const view = teacherView({
      status: 'OPEN',
      submissions: [record(1, 2, 2, ['GPU', 'Linux']), record(1, 1, 1, ['CPU', '作業系統'])],
      results: [
        { questionNumber: 1, winnerGroupId: 1, answers: [] },
        { questionNumber: 2, winnerGroupId: null, answers: null },
        { questionNumber: 3, winnerGroupId: null, answers: null },
        { questionNumber: 4, winnerGroupId: null, answers: null },
      ],
    });
    render(<SubmissionBoard view={view} />);
    const q1 = within(screen.getByRole('article', { name: '第 1 題' }));
    const items = q1.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('第 1 位・第 1 組：（1）CPU（2）作業系統');
    expect(items[0]?.textContent).toContain('搶答成功');
    expect(items[1]?.textContent).toContain('第 2 位・第 2 組');
    expect(items[1]?.textContent).not.toContain('搶答成功');
    expect(
      within(screen.getByRole('article', { name: '第 3 題' })).getByText('尚無組別作答'),
    ).toBeTruthy();
  });

  it('結束後顯示每題搶答成功組別與答案，無人作答標示「無人搶答」', () => {
    const view = teacherView({
      status: 'CLOSED',
      submissions: [record(3, 2, 1, ['0'])],
      results: [
        { questionNumber: 1, winnerGroupId: null, answers: null },
        { questionNumber: 2, winnerGroupId: null, answers: null },
        { questionNumber: 3, winnerGroupId: 2, answers: [{ blankIndex: 1, text: '0' }] },
        { questionNumber: 4, winnerGroupId: null, answers: null },
      ],
    });
    render(<SubmissionBoard view={view} />);
    expect(screen.getByText('搶答結果')).toBeTruthy();
    expect(screen.getByRole('article', { name: '第 3 題' }).textContent).toContain('第 2 組：0');
    expect(screen.getAllByText('無人搶答')).toHaveLength(3);
  });

  it('開啟前顯示說明', () => {
    render(<SubmissionBoard view={teacherView({ status: 'READY' })} />);
    expect(screen.getByText('開啟搶答後，這裡會即時顯示各組送出的答案。')).toBeTruthy();
  });
});
