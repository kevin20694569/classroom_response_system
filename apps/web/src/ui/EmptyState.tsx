import { Icon, type MeaningIconName } from './icons';

/**
 * 等待與空白狀態（007 FR-020、contracts/ui-visual.md §5）：插圖風格的大圖示＋既有的說明文字。
 * animated 時圖示上下漂浮（.ui-anim，減少動態效果時由 CSS 停用），讓使用者知道系統仍在等待。
 */
export function EmptyState({
  icon,
  message,
  animated = false,
}: {
  icon: MeaningIconName;
  message: string;
  animated?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/60 px-4 py-6 text-center">
      <span
        className={`grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-200 to-pink-200 text-primary ${
          animated ? 'ui-anim animate-float' : ''
        }`}
      >
        <Icon name={icon} size={34} />
      </span>
      <p className="font-bold text-ink">{message}</p>
    </div>
  );
}

/**
 * 第一次連線前的載入狀態：三個彈跳圓點＋既有文字「連線中…」。
 * inline 為老師端標題旁的小尺寸版本（contracts/ui-visual.md §5）。
 */
export function LoadingState({ inline = false }: { inline?: boolean }) {
  const dots = (
    <span aria-hidden="true" className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ animationDelay: `${String(i * 0.15)}s` }}
          className={`ui-anim animate-bounce-dot rounded-full bg-primary ${inline ? 'size-1.5' : 'size-3'}`}
        />
      ))}
    </span>
  );
  if (inline) {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted">
        {dots}
        連線中…
      </span>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      {dots}
      <p className="font-bold text-ink-muted">連線中…</p>
    </div>
  );
}
