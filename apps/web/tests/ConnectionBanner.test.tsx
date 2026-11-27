import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionBanner } from '../src/ui/ConnectionBanner';
import { RECONNECTED_NOTICE_MS } from '../src/ui/timing';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ConnectionBanner（007 FR-021）', () => {
  it('第一次連線前與第一次連線後都不顯示任何內容', () => {
    const { rerender, container } = render(
      <ConnectionBanner connected={false} disconnectedText="連線中…" />,
    );
    expect(container.textContent).toBe('');
    rerender(<ConnectionBanner connected disconnectedText="連線中…" />);
    expect(container.textContent).toBe('');
  });

  it('連上後斷線顯示中斷文字；恢復時顯示「已重新連線」並自動消失；不攔截點擊', () => {
    const { rerender } = render(<ConnectionBanner connected disconnectedText="連線中…" />);
    rerender(<ConnectionBanner connected={false} disconnectedText="連線中…" />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('連線中…');
    expect(banner.parentElement?.className).toContain('pointer-events-none');
    rerender(<ConnectionBanner connected disconnectedText="連線中…" />);
    expect(screen.getByText('已重新連線')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(RECONNECTED_NOTICE_MS);
    });
    expect(screen.queryByText('已重新連線')).toBeNull();
  });

  it('沒有傳中斷文字時，斷線不顯示，只在恢復時顯示「已重新連線」', () => {
    const { rerender, container } = render(<ConnectionBanner connected />);
    rerender(<ConnectionBanner connected={false} />);
    expect(container.textContent).toBe('');
    rerender(<ConnectionBanner connected />);
    expect(screen.getByText('已重新連線')).toBeTruthy();
  });
});
