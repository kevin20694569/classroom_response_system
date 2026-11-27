import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { phaseStyle } from './phaseStyle';
import { ON_COLOR } from './theme';
import { PHASE_TOAST_MS } from './timing';
import type { PhaseTransition } from './usePhaseTransition';

/**
 * 切換提示（007 FR-012～FR-014、contracts/ui-effects.md §1）：「搶答開始！」「搶答結束」。
 * 疊在畫面上方中央、外層 pointer-events-none，不攔截任何操作；PHASE_TOAST_MS 後自動消失。
 * 新的變化（新的 key）直接取代舊提示並重新計時。減少動態效果時 .ui-anim 不播放彈出動畫。
 */
export function PhaseTransitionToast({ transition }: { transition: PhaseTransition | null }) {
  const [hiddenKey, setHiddenKey] = useState<number | null>(null);

  useEffect(() => {
    if (transition === null || transition.text === null) return undefined;
    const { key } = transition;
    const timer = setTimeout(() => {
      setHiddenKey(key);
    }, PHASE_TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [transition]);

  if (transition === null || transition.text === null || hiddenKey === transition.key) return null;
  const { color, icon } = phaseStyle(transition.to);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4"
    >
      <div
        key={transition.key}
        style={{ backgroundColor: color, color: ON_COLOR }}
        className="ui-anim flex animate-pop-in items-center gap-3 rounded-full px-8 py-4 text-3xl font-black shadow-card ring-4 ring-white"
      >
        <Icon name={icon} size={34} />
        {transition.text}
      </div>
    </div>
  );
}
