import type { OwnSubmission, SessionStatus } from '@crs/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StudentIdentity } from '../src/api/identity';
import { AnswerSheet } from '../src/pages/student/AnswerSheet';
import * as AnswerDraftStore from '../src/student/answerDraftStore';
import { studentView } from './viewBuilders';

const identity: StudentIdentity = {
  role: 'student',
  groupId: 2,
  activityId: '7c1d7a8e-6f3b-4c2a-9a63-6b2b1f1d0c11',
  memberId: '3f0b2c1e-1111-4222-8333-444455556666',
  nickname: 'Milo',
  expiresAt: '2999-01-01T00:00:00.000Z',
};

function renderSheet(
  status: SessionStatus = 'OPEN',
  ownSubmissions: OwnSubmission[] = [],
  connected = true,
) {
  const { questions } = studentView();
  const props = { questions, ownSubmissions, status, connected, identity, onInvalidated: vi.fn() };
  return { ...render(<AnswerSheet {...props} />), props };
}

const nav = () => screen.getByRole('navigation', { name: '題號清單' });

describe('AnswerSheet（003 FR-011～FR-013、Clarifications Q4）', () => {
  it('一次列出全部題目，標示單題或題組', () => {
    renderSheet();
    for (const n of [1, 2, 3, 4])
      expect(screen.getByRole('region', { name: `第 ${n} 題` })).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: '第 1 題' })).getByText('題組（2 子題）'),
    ).toBeTruthy();
    expect(within(screen.getByRole('region', { name: '第 3 題' })).getByText('單題')).toBeTruthy();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('題號清單依本組送出紀錄顯示未作答／已送出', () => {
    renderSheet('OPEN', [
      { questionNumber: 3, answers: [{ blankIndex: 1, text: '0' }], submitterNickname: null },
    ]);
    const buttons = within(nav())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(buttons).toEqual([
      '第 1 題 未作答',
      '第 2 題 未作答',
      '第 3 題 已送出',
      '第 4 題 未作答',
    ]);
  });

  it('點題號捲到該題並聚焦第一個輸入欄', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderSheet();
    await userEvent.click(within(nav()).getByRole('button', { name: /第 2 題/ }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('第 2 題（1）'));
  });

  it('同組其他分頁先送出時該題變為已送出，並清除該題草稿', () => {
    AnswerDraftStore.save(identity.activityId, 2, 3, ['我的草稿']);
    const { rerender, props } = renderSheet();
    rerender(
      <AnswerSheet
        {...props}
        ownSubmissions={[
          {
            questionNumber: 3,
            answers: [{ blankIndex: 1, text: '另一分頁的答案' }],
            submitterNickname: null,
          },
        ]}
      />,
    );
    expect(screen.getByText('另一分頁的答案')).toBeTruthy();
    expect(AnswerDraftStore.load(identity.activityId, 2, 3, 1)).toEqual(['']);
  });

  it('待開始時輸入停用並提示等待老師開啟搶答', () => {
    renderSheet('READY');
    expect(screen.getByText('等待老師開啟搶答')).toBeTruthy();
    for (const input of screen.getAllByRole<HTMLInputElement>('textbox')) {
      expect(input.disabled).toBe(true);
    }
  });

  it('斷線時送出停用但仍可輸入', async () => {
    renderSheet('OPEN', [], false);
    const input = screen.getByLabelText('第 3 題答案');
    await userEvent.type(input, '答案');
    expect(screen.getByLabelText<HTMLInputElement>('第 3 題答案').value).toBe('答案');
    const region = screen.getByRole('region', { name: '第 3 題' });
    expect(within(region).getByRole<HTMLButtonElement>('button', { name: '送出' }).disabled).toBe(
      true,
    );
  });
});
