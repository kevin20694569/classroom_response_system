import { SESSION_STATUS_LABEL, type SessionStatus } from '@crs/shared';

const STYLE: Readonly<Record<SessionStatus, string>> = {
  NOT_IMPORTED: 'bg-slate-200 text-slate-700',
  READY: 'bg-amber-100 text-amber-800',
  OPEN: 'bg-green-100 text-green-800',
  CLOSED: 'bg-indigo-100 text-indigo-800',
};

/** 顯示活動階段：尚未匯入／待開始／搶答進行中／已結束。 */
export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${STYLE[status]}`}
    >
      {SESSION_STATUS_LABEL[status]}
    </span>
  );
}
