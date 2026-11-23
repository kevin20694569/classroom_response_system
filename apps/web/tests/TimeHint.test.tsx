import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { computeTooltipPosition, TimeHint } from '../src/components/TimeHint';

const OPENED = '2026-11-23T02:32:02.783Z';
const RECEIVED = '2026-11-23T02:32:15.123Z';

function renderHint() {
  return render(
    <div data-testid="layout">
      <TimeHint receivedAt={RECEIVED} openedAt={OPENED} />
    </div>,
  );
}
const button = () => screen.getByRole('button', { name: '查看提交時間' });

describe('TimeHint（002 US3）', () => {
  it('滑鼠移入顯示提交時間與開始後時間，移出後關閉', () => {
    renderHint();
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerEnter(button());
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('提交時間 10:32:15.123');
    expect(tooltip.textContent).toContain('開始後 00:12.34');
    expect(button().getAttribute('aria-describedby')).toBe(tooltip.id);
    fireEvent.pointerLeave(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('鍵盤聚焦時顯示，Esc 或離開焦點時關閉', async () => {
    const user = userEvent.setup();
    renderHint();
    await user.tab();
    expect(document.activeElement).toBe(button());
    expect(screen.getByRole('tooltip')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    await user.tab({ shift: true });
    await user.tab();
    expect(screen.getByRole('tooltip')).toBeTruthy();
    await user.tab();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('小視窗以 Portal 渲染在 body 下，不在原本的版面容器內（不推擠版面）', () => {
    renderHint();
    fireEvent.pointerEnter(button());
    const tooltip = screen.getByRole('tooltip');
    expect(screen.getByTestId('layout').contains(tooltip)).toBe(false);
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip.style.position).toBe('fixed');
  });
});

describe('computeTooltipPosition（FR-016）', () => {
  const tooltip = { width: 160, height: 40 };
  const viewport = { width: 800, height: 600 };

  it('預設放在按鈕上方置中', () => {
    expect(
      computeTooltipPosition({ top: 300, left: 400, width: 20, height: 20 }, tooltip, viewport),
    ).toEqual({ top: 254, left: 330 });
  });

  it('靠近上緣時改放下方', () => {
    const pos = computeTooltipPosition(
      { top: 10, left: 400, width: 20, height: 20 },
      tooltip,
      viewport,
    );
    expect(pos.top).toBe(36);
  });

  it('靠近左右邊緣時水平位置夾在可視範圍內', () => {
    const left = computeTooltipPosition(
      { top: 300, left: 0, width: 20, height: 20 },
      tooltip,
      viewport,
    );
    expect(left.left).toBeGreaterThanOrEqual(0);
    const right = computeTooltipPosition(
      { top: 300, left: 790, width: 20, height: 20 },
      tooltip,
      viewport,
    );
    expect(right.left + tooltip.width).toBeLessThanOrEqual(viewport.width);
  });
});
