import { useEffect, useState } from 'react';

/**
 * 寬版面的視窗寬度門檻（006 spec Assumptions「解析度畫面夠大」）：1600 px。
 * 主畫面最寬 1024 px 並在視窗中置中時，右側框架寬為（視窗寬 − 1024）÷ 2；1600 px 時為 288 px，才放得下面板。
 * 達到門檻時「分組情況」固定在右側框架中置中（FR-011），否則收合成浮動按鈕（FR-012）。
 */
export const WIDE_LAYOUT_MIN_WIDTH = 1600;

const QUERY = `(min-width: ${WIDE_LAYOUT_MIN_WIDTH}px)`;

/** 視窗寬度是否達到寬版面門檻；跨過門檻時立即更新，不需重新整理（FR-014）。 */
export function useWideLayout(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      setWide(event.matches);
    };
    // 掛載前後寬度可能已改變，以目前的值為準
    setWide(media.matches);
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  return wide;
}
