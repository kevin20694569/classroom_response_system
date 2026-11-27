import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function currentMatches(): boolean {
  // 舊瀏覽器或測試環境沒有 matchMedia 時，視為沒有開啟（contracts/ui-effects.md §8）
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/**
 * 使用者是否在系統開啟「減少動態效果」（007 FR-023）。CSS 動畫由 index.css 的 .ui-anim 規則統一停用；
 * 這個 hook 給需要由 JS 決定「要不要渲染」的效果使用（例如慶祝紙片）。設定改變時即時更新。
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(currentMatches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };
    setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  return reduced;
}
