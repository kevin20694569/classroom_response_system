import { TeacherViewResponseSchema, type TeacherView } from '@crs/shared';
import { useState } from 'react';
import { ApiError, apiRequest } from '../../api/http';
import { ErrorBanner, type DisplayError } from '../../components/ErrorBanner';
import { SessionTimer } from '../../components/SessionTimer';

export const CLOSE_CONFIRM_MESSAGE = '結束後各組無法再作答，也不能重新開啟。確定要結束搶答嗎？';
export const CLOSED_HINT = '搶答已結束。要再進行搶答請重新匯入，開始新的一場。';

/** 開啟、結束搶答（US2）：按鈕只在允許的狀態啟用；伺服器仍會再次檢查狀態機。 */
export function SessionControls({ view }: { view: TeacherView }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DisplayError | null>(null);

  const run = async (action: 'open' | 'close') => {
    if (action === 'close' && !window.confirm(CLOSE_CONFIRM_MESSAGE)) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/session/${action}`, TeacherViewResponseSchema, {
        method: 'POST',
        body: {},
      });
    } catch (e) {
      setError(
        e instanceof ApiError ? { message: e.message } : { message: '操作失敗，請稍後再試。' },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="活動控制" className="space-y-3 rounded-xl bg-white p-5 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">活動控制</h2>
        <SessionTimer
          status={view.status}
          openedAt={view.openedAt}
          closedAt={view.closedAt}
          serverNow={view.serverNow}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || view.status !== 'READY'}
          onClick={() => void run('open')}
          className="rounded-md bg-green-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          開啟搶答
        </button>
        <button
          type="button"
          disabled={busy || view.status !== 'OPEN'}
          onClick={() => void run('close')}
          className="rounded-md bg-rose-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          結束搶答
        </button>
        {view.status === 'NOT_IMPORTED' && (
          <span className="text-sm text-slate-500">請先匯入題目。</span>
        )}
        {view.status === 'CLOSED' && <span className="text-sm text-slate-600">{CLOSED_HINT}</span>}
      </div>
      <ErrorBanner error={error} />
    </section>
  );
}
