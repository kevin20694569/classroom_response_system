import type { ReactNode } from 'react';
import { Icon, type MeaningIconName } from './icons';

/**
 * 區塊標題（007 FR-001、FR-006）：左側彩色圖示方塊＋標題文字。
 * 圖示 aria-hidden，標題的可存取名稱只有文字（既有測試以名稱尋找 heading）。
 */
export function SectionHeading({ icon, children }: { icon: MeaningIconName; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-primary">
        <Icon name={icon} size={18} />
      </span>
      {children}
    </h2>
  );
}
