import type { SessionStatus } from '@crs/shared';
import { Icon } from '../ui/icons';
import { phaseStyle } from '../ui/phaseStyle';

/**
 * 顯示活動階段：尚未匯入／待開始／搶答進行中／已結束。
 * 007：白底膠囊、階段強調色的文字、外框與圖示（FR-010、FR-011）；白底讓它放在組別色頂端列上也維持對比。
 */
export function StatusBadge({ status }: { status: SessionStatus }) {
  const { label, color, icon } = phaseStyle(status);
  return (
    <span
      data-testid="status-badge"
      style={{ color, borderColor: color }}
      className="inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-3 py-1 text-sm font-extrabold"
    >
      <Icon name={icon} size={16} />
      {label}
    </span>
  );
}
