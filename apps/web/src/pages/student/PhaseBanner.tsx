import type { SessionStatus } from '@crs/shared';
import { groupName } from '@crs/shared';
import type { ReactNode } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../ui/Button';
import { groupIdentity } from '../../ui/groupIdentity';
import { Icon } from '../../ui/icons';
import { ON_COLOR } from '../../ui/theme';

export interface PhaseBannerProps {
  groupId: number;
  /** 本分頁的暱稱（004 FR-008） */
  nickname: string;
  status: SessionStatus;
  connected: boolean;
  onLeave: () => void;
  /** 搶答計時（004 FR-029）；由頁面提供，與老師端共用同一個元件 */
  timer?: ReactNode;
}

/**
 * 頂端列（003 FR-004、FR-009、FR-010）：一直顯示組別、暱稱（004 FR-008）與活動階段；
 * 只有「待開始」提供離開組別（FR-005、Clarifications Q2），避免搶答中換組。
 * 007：整條頂端列為本組顏色、白字並顯示本組圖示（FR-009a）；階段標籤、計時放在白底膠囊內，維持對比（FR-011）。
 */
export function PhaseBanner({
  groupId,
  nickname,
  status,
  connected,
  onLeave,
  timer,
}: PhaseBannerProps) {
  const { color, icon } = groupIdentity(groupId);
  return (
    <header
      style={{ backgroundColor: color, color: ON_COLOR }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 shadow-card"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/20">
          <Icon name={icon} size={26} />
        </span>
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">
          <span className="text-2xl font-black">{groupName(groupId)}</span>
          <span className="text-xl font-bold">・{nickname}</span>
        </span>
        <StatusBadge status={status} />
        {!connected && (
          <span
            role="status"
            className="rounded-full bg-white px-3 py-1 text-sm font-bold text-red-700"
          >
            連線中斷，正在重新連線
          </span>
        )}
      </div>
      {timer !== undefined && (
        <div className="rounded-2xl bg-white px-3 py-1.5 text-ink">{timer}</div>
      )}
      {status === 'READY' && (
        <Button variant="danger" size="sm" onClick={onLeave}>
          離開組別
        </Button>
      )}
    </header>
  );
}
