import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GroupBadge } from '../src/ui/GroupBadge';
import { groupIdentity } from '../src/ui/groupIdentity';

/** jsdom 會把 inline style 的顏色轉成 rgb()，比對前先轉換。 */
function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

describe('GroupBadge（007 FR-007、contracts/ui-visual.md §3）', () => {
  it('顯示「第 N 組」，底色為該組顏色，圖示對螢幕閱讀器隱藏', () => {
    render(<GroupBadge groupId={3} />);
    const badge = screen.getByText('第 3 組');
    expect(badge.style.backgroundColor).toBe(rgb(groupIdentity(3).color));
    const icon = badge.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('data-icon')).toBe(groupIdentity(3).icon);
    expect(badge.textContent).toBe('第 3 組');
  });

  it('只顯示標記時沒有任何文字，整個標記對螢幕閱讀器隱藏', () => {
    const { container } = render(<GroupBadge groupId={12} showName={false} />);
    const mark = container.firstElementChild as HTMLElement;
    expect(mark.textContent).toBe('');
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.style.backgroundColor).toBe(rgb(groupIdentity(12).color));
    expect(mark.querySelector('svg')?.getAttribute('data-icon')).toBe(groupIdentity(12).icon);
  });
});
