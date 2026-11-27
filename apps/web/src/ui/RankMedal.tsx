import { Icon } from './icons';
import { MEDAL_COLORS } from './theme';

const MEDALS = [
  { kind: 'gold', color: MEDAL_COLORS.gold },
  { kind: 'silver', color: MEDAL_COLORS.silver },
  { kind: 'bronze', color: MEDAL_COLORS.bronze },
] as const;

/**
 * 第 1～3 名的金、銀、銅獎牌（007 FR-017、contracts/ui-effects.md §4）；第 4 名以後不顯示。
 * 只是圖示，旁邊一定有「第 N 名」文字，所以對螢幕閱讀器隱藏、也不只靠顏色辨識。
 */
export function RankMedal({ rank }: { rank: number }) {
  const medal = MEDALS[rank - 1];
  if (medal === undefined) return null;
  return (
    <span data-medal={medal.kind} aria-hidden="true" className="mr-1 inline-flex align-[-0.2em]">
      <Icon name="medal" size={18} style={{ color: medal.color }} />
    </span>
  );
}
