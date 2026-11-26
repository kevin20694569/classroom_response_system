import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWideLayout, WIDE_LAYOUT_MIN_WIDTH } from '../src/hooks/useWideLayout';
import { installMatchMedia } from './fakeMatchMedia';

describe('useWideLayout（006 FR-011、FR-012、FR-014）', () => {
  it('以 1600 px 為門檻查詢視窗寬度（主畫面 1024 px 置中時右側才放得下面板）', () => {
    const media = installMatchMedia(true);
    renderHook(() => useWideLayout());
    expect(WIDE_LAYOUT_MIN_WIDTH).toBe(1600);
    expect(media.queries).toContain('(min-width: 1600px)');
  });

  it('初始值反映目前的視窗寬度', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useWideLayout());
    expect(result.current).toBe(false);
  });

  it('跨過門檻時立即更新，卸載後移除監聽', () => {
    const media = installMatchMedia(true);
    const { result, unmount } = renderHook(() => useWideLayout());
    expect(result.current).toBe(true);
    media.setMatches(false);
    expect(result.current).toBe(false);
    media.setMatches(true);
    expect(result.current).toBe(true);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
