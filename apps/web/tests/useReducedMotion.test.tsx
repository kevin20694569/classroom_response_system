import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from '../src/ui/useReducedMotion';
import { installMatchMedia } from './fakeMatchMedia';

describe('useReducedMotion（FR-023）', () => {
  it('瀏覽器沒有 matchMedia 時視為沒有開啟', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('讀取 prefers-reduced-motion，設定改變時即時更新', () => {
    const media = installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
    expect(media.queries).toContain('(prefers-reduced-motion: reduce)');
    media.setMatches(false);
    expect(result.current).toBe(false);
  });

  it('卸載後取消訂閱', () => {
    const media = installMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
