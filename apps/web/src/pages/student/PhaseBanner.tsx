import type { SessionStatus } from '@crs/shared';
import { groupName } from '@crs/shared';
import type { ReactNode } from 'react';
import { StatusBadge } from '../../components/StatusBadge';

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
 */
export function PhaseBanner({
  groupId,
  nickname,
  status,
  connected,
  onLeave,
  timer,
}: PhaseBannerProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow">
      <div className="flex items-center gap-3">
        <span>
          <span className="text-xl font-bold">{groupName(groupId)}</span>
          <span className="text-xl">・{nickname}</span>
        </span>
        <StatusBadge status={status} />
        {!connected && (
          <span role="status" className="text-sm text-red-700">
            連線中斷，正在重新連線
          </span>
        )}
      </div>
      {timer}
      {status === 'READY' && (
        <button type="button" className="text-sm text-slate-600 underline" onClick={onLeave}>
          離開組別
        </button>
      )}
    </header>
  );
}
