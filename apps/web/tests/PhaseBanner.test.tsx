import type { SessionStatus } from '@crs/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhaseBanner } from '../src/pages/student/PhaseBanner';
import { groupIdentity } from '../src/ui/groupIdentity';

/** jsdom 會把 inline style 的顏色轉成 rgb()，比對前先轉換。 */
function rgbOf(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

describe('PhaseBanner（003 FR-004、FR-005、FR-009、FR-010）', () => {
  it.each<[SessionStatus, string, boolean]>([
    ['READY', '待開始', true],
    ['OPEN', '搶答進行中', false],
    ['CLOSED', '已結束', false],
  ])('%s：顯示「%s」，離開組別=%s', (status, label, canLeave) => {
    render(<PhaseBanner groupId={2} nickname="Milo" status={status} connected onLeave={vi.fn()} />);
    expect(screen.getByText('第 2 組')).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '離開組別' }) !== null).toBe(canLeave);
  });

  it('待開始時點「離開組別」呼叫 onLeave', async () => {
    const onLeave = vi.fn();
    render(<PhaseBanner groupId={1} nickname="Milo" status="READY" connected onLeave={onLeave} />);
    await userEvent.click(screen.getByRole('button', { name: '離開組別' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('組別旁顯示暱稱（004 FR-008）', () => {
    render(<PhaseBanner groupId={2} nickname="小明" status="READY" connected onLeave={vi.fn()} />);
    expect(screen.getByText('・小明')).toBeTruthy();
  });

  it('斷線時顯示重新連線提示', () => {
    const { rerender } = render(
      <PhaseBanner groupId={1} nickname="Milo" status="OPEN" connected onLeave={vi.fn()} />,
    );
    expect(screen.queryByText('連線中斷，正在重新連線')).toBeNull();
    rerender(
      <PhaseBanner groupId={1} nickname="Milo" status="OPEN" connected={false} onLeave={vi.fn()} />,
    );
    expect(screen.getByText('連線中斷，正在重新連線')).toBeTruthy();
  });

  it('頂端列底色為本組顏色並顯示本組圖示（007 FR-009a）', () => {
    const { container } = render(
      <PhaseBanner groupId={7} nickname="Milo" status="READY" connected onLeave={vi.fn()} />,
    );
    const banner = container.querySelector('header') as HTMLElement;
    expect(banner.style.backgroundColor).toBe(rgbOf(groupIdentity(7).color));
    expect(banner.querySelector(`svg[data-icon="${groupIdentity(7).icon}"]`)).not.toBeNull();
  });
});
