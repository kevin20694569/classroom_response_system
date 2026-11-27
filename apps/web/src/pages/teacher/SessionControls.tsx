import { TeacherViewResponseSchema, type TeacherView } from '@crs/shared';
import { useState } from 'react';
import { ApiError, apiRequest } from '../../api/http';
import { ErrorBanner, type DisplayError } from '../../components/ErrorBanner';
import { SessionTimer } from '../../components/SessionTimer';
import { Button } from '../../ui/Button';
import { SectionHeading } from '../../ui/SectionHeading';
import { CARD, MUTED } from '../../ui/styles';

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
    <section aria-label="活動控制" className={`space-y-4 ${CARD}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading icon="open">活動控制</SectionHeading>
        <SessionTimer
          status={view.status}
          openedAt={view.openedAt}
          closedAt={view.closedAt}
          serverNow={view.serverNow}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          pending={busy && view.status === 'READY'}
          disabled={busy || view.status !== 'READY'}
          onClick={() => void run('open')}
        >
          開啟搶答
        </Button>
        <Button
          variant="danger"
          size="lg"
          pending={busy && view.status === 'OPEN'}
          disabled={busy || view.status !== 'OPEN'}
          onClick={() => void run('close')}
        >
          結束搶答
        </Button>
        {view.status === 'NOT_IMPORTED' && <span className={MUTED}>請先匯入題目。</span>}
        {view.status === 'CLOSED' && <span className={MUTED}>{CLOSED_HINT}</span>}
      </div>
      <ErrorBanner error={error} />
    </section>
  );
}
