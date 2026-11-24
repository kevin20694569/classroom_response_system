import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/api/http';
import { JoinGroupPanel } from '../src/pages/student/JoinGroupPanel';
import { publicView } from './viewBuilders';

describe('JoinGroupPanel（003 FR-001、FR-002）', () => {
  it('尚未匯入時顯示等待訊息、沒有組別按鈕', () => {
    const view = publicView({ status: 'NOT_IMPORTED' });
    render(
      <JoinGroupPanel
        status={view.status}
        groups={view.groups}
        headcounts={view.headcounts}
        notice={null}
        nickname="Milo"
        onEditNickname={vi.fn()}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.getByText('老師尚未匯入題目，請稍候')).toBeTruthy();
    // 只有「修改暱稱」，沒有組別按鈕
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['修改暱稱']);
  });

  it('依序列出組別，點擊呼叫 onJoin', async () => {
    const onJoin = vi.fn(() => Promise.resolve());
    const view = publicView();
    render(
      <JoinGroupPanel
        status={view.status}
        groups={view.groups}
        headcounts={view.headcounts}
        notice={null}
        nickname="Milo"
        onEditNickname={vi.fn()}
        onJoin={onJoin}
      />,
    );
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((name) => name !== null);
    expect(names).toEqual(['第 1 組', '第 2 組', '第 3 組']);
    await userEvent.click(screen.getByRole('button', { name: '第 2 組' }));
    expect(onJoin).toHaveBeenCalledWith(2);
  });

  it('加入處理中按鈕停用', async () => {
    let finish: () => void = () => undefined;
    const onJoin = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const view = publicView();
    render(
      <JoinGroupPanel
        status={view.status}
        groups={view.groups}
        headcounts={view.headcounts}
        notice={null}
        nickname="Milo"
        onEditNickname={vi.fn()}
        onJoin={onJoin}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '第 1 組' }));
    for (const button of screen.getAllByRole<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
    }
    finish();
  });

  it('加入失敗時顯示伺服器訊息，有失效訊息時顯示在上方', async () => {
    const onJoin = vi.fn(() =>
      Promise.reject(new ApiError('INVALID_GROUP', '沒有第 9 組，請重新選擇組別。')),
    );
    const view = publicView();
    render(
      <JoinGroupPanel
        status={view.status}
        groups={view.groups}
        headcounts={view.headcounts}
        notice="老師已開始新的活動，請重新選擇組別。"
        nickname="Milo"
        onEditNickname={vi.fn()}
        onJoin={onJoin}
      />,
    );
    expect(screen.getByText('老師已開始新的活動，請重新選擇組別。')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '第 1 組' }));
    expect(await screen.findByText('沒有第 9 組，請重新選擇組別。')).toBeTruthy();
  });

  it('顯示目前暱稱，按「修改暱稱」呼叫 onEditNickname（004 FR-007、FR-008）', async () => {
    const onEditNickname = vi.fn();
    const view = publicView();
    render(
      <JoinGroupPanel
        status={view.status}
        groups={view.groups}
        headcounts={view.headcounts}
        notice={null}
        nickname="小明"
        onEditNickname={onEditNickname}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.getByText('暱稱：小明')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '修改暱稱' }));
    expect(onEditNickname).toHaveBeenCalledOnce();
  });

  it('每個組別顯示「已加入：K 人」，沒有人時顯示 0（004 FR-009）', () => {
    const view = publicView({
      headcounts: [
        { groupId: 1, memberCount: 2 },
        { groupId: 2, memberCount: 0 },
        { groupId: 3, memberCount: 1 },
      ],
    });
    render(
      <JoinGroupPanel
        status={view.status}
        groups={view.groups}
        headcounts={view.headcounts}
        notice={null}
        nickname="Milo"
        onEditNickname={vi.fn()}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '第 1 組' }).textContent).toContain('已加入：2 人');
    expect(screen.getByRole('button', { name: '第 2 組' }).textContent).toContain('已加入：0 人');
    expect(screen.getByRole('button', { name: '第 3 組' }).textContent).toContain('已加入：1 人');
  });
});
