import type { Submission } from '@crs/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    submitterNickname: null,
  };
}

describe('SubmissionBoard（US3）', () => {
  it('搶答進行中依順位列出送出紀錄，第一位標示搶答成功，題組依子題分列', () => {
    const view = teacherView({
      status: 'OPEN',
      submissions: [record(1, 2, 2, ['GPU', 'Linux']), record(1, 1, 1, ['CPU', '作業系統'])],
      results: [
        {
          questionNumber: 1,
          winnerGroupId: 1,
          answers: [],
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 2,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 3,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 4,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
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
        {
          questionNumber: 1,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 2,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 3,
          winnerGroupId: 2,
          answers: [{ blankIndex: 1, text: '0' }],
          receivedAt: '2026-11-23T02:00:12.340Z',
          submitterNickname: null,
        },
        {
          questionNumber: 4,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
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

  it('搶答進行中每筆送出紀錄都有時間圖示，滑鼠移入顯示該筆提交時間（002 FR-014）', () => {
    const view = teacherView({
      status: 'OPEN',
      openedAt: '2026-11-23T08:00:00.000Z',
      submissions: [
        { ...record(1, 1, 1, ['CPU', '作業系統']), receivedAt: '2026-11-23T08:00:05.120Z' },
        { ...record(1, 2, 2, ['GPU', 'Linux']), receivedAt: '2026-11-23T08:00:05.480Z' },
      ],
      results: [1, 2, 3, 4].map((n) => ({
        questionNumber: n,
        winnerGroupId: n === 1 ? 1 : null,
        answers: null,
        receivedAt: null,
        submitterNickname: null,
      })),
    });
    render(<SubmissionBoard view={view} />);
    const q1 = within(screen.getByRole('article', { name: '第 1 題' }));
    const hints = q1.getAllByRole('button', { name: '查看提交時間' });
    expect(hints).toHaveLength(2);
    const second = hints[1];
    if (second === undefined) throw new Error('缺少時間圖示');
    fireEvent.pointerEnter(second);
    expect(screen.getByRole('tooltip').textContent).toContain('提交時間 16:00:05.480');
    expect(screen.getByRole('tooltip').textContent).toContain('開始後 00:05.48');
    // 既有順位與「搶答成功」標示不變
    expect(q1.getAllByRole('listitem')[0]?.textContent).toContain('搶答成功');
  });

  it('已結束時有結果的題目有時間圖示，無人搶答的題目沒有', () => {
    const view = teacherView({
      status: 'CLOSED',
      openedAt: '2026-11-23T08:00:00.000Z',
      submissions: [{ ...record(3, 2, 1, ['0']), receivedAt: '2026-11-23T08:00:12.340Z' }],
      results: [
        {
          questionNumber: 1,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 2,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 3,
          winnerGroupId: 2,
          answers: [{ blankIndex: 1, text: '0' }],
          receivedAt: '2026-11-23T08:00:12.340Z',
          submitterNickname: null,
        },
        {
          questionNumber: 4,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
      ],
    });
    render(<SubmissionBoard view={view} />);
    expect(screen.getAllByRole('button', { name: '查看提交時間' })).toHaveLength(1);
    const q3 = within(screen.getByRole('article', { name: '第 3 題' }));
    fireEvent.pointerEnter(q3.getByRole('button', { name: '查看提交時間' }));
    expect(screen.getByRole('tooltip').textContent).toContain('開始後 00:12.34');
    expect(
      within(screen.getByRole('article', { name: '第 1 題' })).queryByRole('button'),
    ).toBeNull();
  });

  it('結束後仍依順位保留所有組別的答案，搶答成功者有標示，每筆都有時間圖示（002 FR-026）', () => {
    const view = teacherView({
      status: 'CLOSED',
      openedAt: '2026-11-23T08:00:00.000Z',
      submissions: [
        { ...record(3, 2, 2, ['1']), receivedAt: '2026-11-23T08:00:06.000Z' },
        { ...record(3, 1, 1, ['0']), receivedAt: '2026-11-23T08:00:05.000Z' },
      ],
      results: [
        {
          questionNumber: 1,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 2,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
        {
          questionNumber: 3,
          winnerGroupId: 1,
          answers: [{ blankIndex: 1, text: '0' }],
          receivedAt: '2026-11-23T08:00:05.000Z',
          submitterNickname: null,
        },
        {
          questionNumber: 4,
          winnerGroupId: null,
          answers: null,
          receivedAt: null,
          submitterNickname: null,
        },
      ],
    });
    render(<SubmissionBoard view={view} />);
    const q3 = within(screen.getByRole('article', { name: '第 3 題' }));
    const items = q3.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('第 1 位・第 1 組：0');
    expect(items[0]?.textContent).toContain('搶答成功');
    expect(items[1]?.textContent).toContain('第 2 位・第 2 組：1');
    expect(items[1]?.textContent).not.toContain('搶答成功');
    expect(q3.getAllByRole('button', { name: '查看提交時間' })).toHaveLength(2);
    expect(screen.getAllByText('無人搶答')).toHaveLength(3);
  });
});

describe('SubmissionBoard — 004 送出者（FR-026）', () => {
  it('每筆送出顯示「第 N 組・暱稱」；沒有送出者時只顯示組別', () => {
    const view = teacherView({
      status: 'OPEN',
      submissions: [
        { ...record(3, 1, 1, ['0']), submitterNickname: 'Milo' },
        record(3, 2, 2, ['1']),
      ],
    });
    render(<SubmissionBoard view={view} />);
    const items = within(screen.getByRole('article', { name: '第 3 題' })).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('第 1 位・第 1 組・Milo：0');
    expect(items[1]?.textContent).toContain('第 2 位・第 2 組：1');
  });
});
