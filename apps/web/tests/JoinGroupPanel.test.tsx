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
      <JoinGroupPanel status={view.status} groups={view.groups} notice={null} onJoin={vi.fn()} />,
    );
    expect(screen.getByText('老師尚未匯入題目，請稍候')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('依序列出組別，點擊呼叫 onJoin', async () => {
    const onJoin = vi.fn(() => Promise.resolve());
    const view = publicView();
    render(
      <JoinGroupPanel status={view.status} groups={view.groups} notice={null} onJoin={onJoin} />,
    );
    const names = screen.getAllByRole('button').map((b) => b.textContent);
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
      <JoinGroupPanel status={view.status} groups={view.groups} notice={null} onJoin={onJoin} />,
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
        notice="老師已開始新的活動，請重新選擇組別。"
        onJoin={onJoin}
      />,
    );
    expect(screen.getByText('老師已開始新的活動，請重新選擇組別。')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '第 1 組' }));
    expect(await screen.findByText('沒有第 9 組，請重新選擇組別。')).toBeTruthy();
  });
});
