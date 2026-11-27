import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhaseTransitionToast } from '../src/ui/PhaseTransitionToast';
import { PHASE_TOAST_MS } from '../src/ui/timing';
import type { PhaseTransition } from '../src/ui/usePhaseTransition';

const start: PhaseTransition = { from: 'READY', to: 'OPEN', text: '搶答開始！', key: 1 };
const end: PhaseTransition = { from: 'OPEN', to: 'CLOSED', text: '搶答結束', key: 2 };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('PhaseTransitionToast（007 FR-012、FR-013）', () => {
  it('顯示提示文字，role=status，不攔截點擊，2 秒內自動消失', () => {
    expect(PHASE_TOAST_MS).toBeLessThanOrEqual(2000);
    render(<PhaseTransitionToast transition={start} />);
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('搶答開始！');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(toast.className).toContain('pointer-events-none');
    act(() => {
      vi.advanceTimersByTime(PHASE_TOAST_MS);
    });
    expect(screen.queryByText('搶答開始！')).toBeNull();
  });

  it('提示顯示期間，底下的按鈕仍可點擊', () => {
    const onClick = vi.fn();
    render(
      <>
        <button type="button" onClick={onClick}>
          送出
        </button>
        <PhaseTransitionToast transition={start} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: '送出' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('新的變化取代舊提示並重新計時', () => {
    const { rerender } = render(<PhaseTransitionToast transition={start} />);
    act(() => {
      vi.advanceTimersByTime(PHASE_TOAST_MS - 200);
    });
    rerender(<PhaseTransitionToast transition={end} />);
    expect(screen.queryByText('搶答開始！')).toBeNull();
    expect(screen.getByText('搶答結束')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(PHASE_TOAST_MS - 200);
    });
    expect(screen.getByText('搶答結束')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('搶答結束')).toBeNull();
  });

  it('沒有變化或沒有提示文字時不顯示', () => {
    const { rerender } = render(<PhaseTransitionToast transition={null} />);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(
      <PhaseTransitionToast transition={{ from: 'CLOSED', to: 'READY', text: null, key: 3 }} />,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
