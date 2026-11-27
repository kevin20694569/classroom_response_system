import { GROUP_COLORS } from './theme';
import { useReducedMotion } from './useReducedMotion';

interface Piece {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
  round: boolean;
}

/**
 * 約 40 片紙片，位置與時間以序號計算（不用亂數，畫面可預期、測試穩定）。
 * 最晚的一片在 0.5 秒延遲＋2.2 秒落下＝2.7 秒內結束，早於 CELEBRATION_MS 移除元件的時間。
 */
const PIECES: readonly Piece[] = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: (i % 6) * 0.1,
  duration: 1.6 + (i % 4) * 0.2,
  drift: ((i % 7) - 3) * 18,
  color: GROUP_COLORS[i % GROUP_COLORS.length] ?? '#7c3aed',
  round: i % 3 === 0,
}));

/**
 * 學生端慶祝紙片（007 FR-019、contracts/ui-effects.md §6）：疊在畫面上方、不攔截點擊與捲動。
 * 何時播放由頁面決定；系統設定減少動態效果時完全不渲染（FR-023）。
 */
export function Celebration({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  if (!active || reduced) return null;
  return (
    <div
      data-testid="celebration"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {PIECES.map((piece, i) => (
        <span
          key={i}
          className={`ui-anim absolute -top-4 block ${piece.round ? 'size-3 rounded-full' : 'h-4 w-2 rounded-sm'}`}
          style={{
            left: `${String(piece.left)}%`,
            backgroundColor: piece.color,
            animation: `confetti-fall ${String(piece.duration)}s ease-in ${String(piece.delay)}s both`,
            ['--confetti-drift' as string]: `${String(piece.drift)}px`,
          }}
        />
      ))}
    </div>
  );
}
