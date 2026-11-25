import type { SessionStatus } from '@crs/shared';
import { useEffect, useMemo, useState } from 'react';
import { formatElapsed } from '../utils/timeFormat';

interface SessionTimerProps {
  status: SessionStatus;
  openedAt: string | null;
  closedAt: string | null;
  serverNow: string;
}

/**
 * 搶答計時（002 US2，research R5；004 FR-029 起老師端與學生端共用）：
 * - 以伺服器記錄的開啟時間為起點；收到資料時以 serverNow 校正瀏覽器時鐘（FR-012）。
 * - 搶答進行中每個畫面影格都由時鐘重新計算（requestAnimationFrame，約每秒 60 次，FR-010），
 *   不累加，因此分頁從背景切回時立即顯示正確值。
 * - 已結束時停在「結束時間 − 開啟時間」；尚未開始時為 00:00.00（FR-011）。
 * - 只更新本元件自己的 state，不會讓整個老師端畫面每格重新繪製。
 */
export function SessionTimer({ status, openedAt, closedAt, serverNow }: SessionTimerProps) {
  // serverNow 改變（收到新的伺服器資料）時重新計算瀏覽器與伺服器的時間差
  const offset = useMemo(() => Date.parse(serverNow) - Date.now(), [serverNow]);
  const running = status === 'OPEN' && openedAt !== null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return undefined;
    let frame = requestAnimationFrame(function tick() {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [running]);

  let elapsed = 0;
  if (openedAt !== null && status === 'CLOSED' && closedAt !== null) {
    elapsed = Date.parse(closedAt) - Date.parse(openedAt);
  } else if (running) {
    elapsed = now + offset - Date.parse(openedAt);
  }

  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-sm text-slate-600">搶答計時</span>
      <span
        aria-label="搶答計時"
        aria-live="off"
        className={`font-mono text-2xl font-semibold tabular-nums ${running ? 'text-green-700' : 'text-slate-700'}`}
      >
        {formatElapsed(elapsed)}
      </span>
    </span>
  );
}
