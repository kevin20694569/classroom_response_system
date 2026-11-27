import { groupName, type GroupId } from '@crs/shared';
import { GROUP_ICON_NAMES, type GroupIconName } from './icons';
import { GROUP_COLORS } from './theme';

/** 組別識別（007 data-model §1）：由組別編號推得，不需儲存或設定。 */
export interface GroupIdentity {
  groupId: GroupId;
  /** 組別色（對白字 ≥ 4.5:1） */
  color: string;
  icon: GroupIconName;
  /** 沿用 groupName，「第 N 組」 */
  name: string;
}

/**
 * 依組別編號固定指派（FR-007）：顏色 = GROUP_COLORS[(n − 1) mod 10]，圖示 = GROUP_ICON_NAMES[n − 1]。
 * 1～20 任兩組的 (color, icon) 不相同，因為 20 個圖示兩兩不同（FR-008）；第 1 組與第 11 組同色、圖示不同。
 */
export function groupIdentity(groupId: GroupId): GroupIdentity {
  const color = GROUP_COLORS[(groupId - 1) % GROUP_COLORS.length];
  const icon = GROUP_ICON_NAMES[groupId - 1];
  // GroupIdSchema 限制 1～20，超出代表契約被破壞，直接丟錯而不是悄悄顯示錯的識別
  if (color === undefined || icon === undefined)
    throw new RangeError(`組別編號超出範圍：${String(groupId)}`);
  return { groupId, color, icon, name: groupName(groupId) };
}
