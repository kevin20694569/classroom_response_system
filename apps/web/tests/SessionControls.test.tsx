import type { SessionStatus } from '@crs/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CLOSE_CONFIRM_MESSAGE,
  CLOSED_HINT,
  SessionControls,
} from '../src/pages/teacher/SessionControls';
import { mockFetch } from './helpers';
import { teacherView } from './viewBuilders';

function buttons() {
  return {
    open: screen.getByRole<HTMLButtonElement>('button', { name: '開啟搶答' }),
    close: screen.getByRole<HTMLButtonElement>('button', { name: '結束搶答' }),
  };
}

describe('SessionControls（US2）', () => {
  it.each<[SessionStatus, boolean, boolean]>([
    ['NOT_IMPORTED', false, false],
    ['READY', true, false],
    ['OPEN', false, true],
    ['CLOSED', false, false],
  ])('%s：開啟=%s、結束=%s', (status, canOpen, canClose) => {
    render(<SessionControls view={teacherView({ status })} />);
    expect(buttons().open.disabled).toBe(!canOpen);
    expect(buttons().close.disabled).toBe(!canClose);
    // 002：每種狀態都有搶答計時
    expect(screen.getByLabelText('搶答計時')).toBeTruthy();
  });

  it('開啟時呼叫 /api/session/open', async () => {
    const { calls } = mockFetch([{ status: 200, body: { view: teacherView({ status: 'OPEN' }) } }]);
    render(<SessionControls view={teacherView({ status: 'READY' })} />);
    await userEvent.click(buttons().open);
    expect(calls[0]?.url).toBe('/api/session/open');
  });

  it('結束前先確認；取消時不送出', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { fetchMock } = mockFetch([]);
    render(<SessionControls view={teacherView({ status: 'OPEN' })} />);
    await userEvent.click(buttons().close);
    expect(confirm).toHaveBeenCalledWith(CLOSE_CONFIRM_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('確認後呼叫 /api/session/close；錯誤時顯示訊息', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch([
      { status: 409, body: { error: { code: 'ALREADY_IN_STATE', message: '搶答已經結束。' } } },
    ]);
    render(<SessionControls view={teacherView({ status: 'OPEN' })} />);
    await userEvent.click(buttons().close);
    expect((await screen.findByRole('alert')).textContent).toContain('搶答已經結束。');
  });

  it('已結束時提示要重新匯入', () => {
    render(<SessionControls view={teacherView({ status: 'CLOSED' })} />);
    expect(screen.getByText(CLOSED_HINT)).toBeTruthy();
  });
});
