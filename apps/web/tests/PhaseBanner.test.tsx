import type { SessionStatus } from '@crs/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhaseBanner } from '../src/pages/student/PhaseBanner';

describe('PhaseBanner（003 FR-004、FR-005、FR-009、FR-010）', () => {
  it.each<[SessionStatus, string, boolean]>([
    ['READY', '待開始', true],
    ['OPEN', '搶答進行中', false],
    ['CLOSED', '已結束', false],
  ])('%s：顯示「%s」，離開組別=%s', (status, label, canLeave) => {
    render(<PhaseBanner groupId={2} status={status} connected onLeave={vi.fn()} />);
    expect(screen.getByText('第 2 組')).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '離開組別' }) !== null).toBe(canLeave);
  });

  it('待開始時點「離開組別」呼叫 onLeave', async () => {
    const onLeave = vi.fn();
    render(<PhaseBanner groupId={1} status="READY" connected onLeave={onLeave} />);
    await userEvent.click(screen.getByRole('button', { name: '離開組別' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('斷線時顯示重新連線提示', () => {
    const { rerender } = render(
      <PhaseBanner groupId={1} status="OPEN" connected onLeave={vi.fn()} />,
    );
    expect(screen.queryByText('連線中斷，正在重新連線')).toBeNull();
    rerender(<PhaseBanner groupId={1} status="OPEN" connected={false} onLeave={vi.fn()} />);
    expect(screen.getByText('連線中斷，正在重新連線')).toBeTruthy();
  });
});
