import type { GroupId } from '@crs/shared';
import { groupIdentity } from './groupIdentity';
import { Icon } from './icons';
import { ON_COLOR } from './theme';

export interface GroupBadgeProps {
  groupId: GroupId;
  size?: 'sm' | 'md';
  /**
   * false 時只顯示圓形標記（顏色＋圖示），整個標記 aria-hidden；
   * 用在旁邊文字已經寫出「第 N 組」的地方，避免同一畫面重複組名（contracts/ui-visual.md §3）。
   */
  showName?: boolean;
}

/**
 * 組別徽章（007 FR-007～FR-009）：組別色圓角膠囊＋白色組別圖示＋「第 N 組」。
 * 圖示只作視覺識別，可存取文字只有「第 N 組」。
 */
export function GroupBadge({ groupId, size = 'md', showName = true }: GroupBadgeProps) {
  const { color, icon, name } = groupIdentity(groupId);
  const style = { backgroundColor: color, color: ON_COLOR };
  if (!showName) {
    return (
      <span
        aria-hidden="true"
        data-group={groupId}
        style={style}
        className={`inline-grid shrink-0 place-items-center rounded-full ${size === 'sm' ? 'size-6' : 'size-8'}`}
      >
        <Icon name={icon} size={size === 'sm' ? 14 : 18} />
      </span>
    );
  }
  return (
    <span
      data-group={groupId}
      style={style}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      <Icon name={icon} size={size === 'sm' ? 13 : 16} />
      {name}
    </span>
  );
}
