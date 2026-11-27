import type { SessionStatus } from '@crs/shared';
import { useEffect, useRef, useState } from 'react';

/** 本分頁當場看到的一次階段變化（007 data-model §3）。 */
export interface PhaseTransition {
  from: SessionStatus;
  to: SessionStatus;
  /** 只有 READY→OPEN、OPEN→CLOSED 有提示文字 */
  text: '搶答開始！' | '搶答結束' | null;
  /** 每次變化遞增，讓新的提示取代尚未消失的舊提示 */
  key: number;
}

function textFor(from: SessionStatus, to: SessionStatus): PhaseTransition['text'] {
  if (from === 'READY' && to === 'OPEN') return '搶答開始！';
  if (from === 'OPEN' && to === 'CLOSED') return '搶答結束';
  return null;
}

/**
 * 判斷「本分頁當場看到的階段變化」（007 FR-014、FR-019、FR-029，research R6）：
 * 以本分頁上一次看到的階段為 baseline。第一份資料、status 為 null（連線中、身分剛改變），
 * 或斷線後收到的第一份資料只建立 baseline，不算變化——所以重新整理、重連都不會重播提示、慶祝或結果揭曉。
 * 只存在元件記憶中，不寫入任何 storage。
 */
export function usePhaseTransition(
  status: SessionStatus | null,
  connected: boolean,
): PhaseTransition | null {
  const [transition, setTransition] = useState<PhaseTransition | null>(null);
  const baseline = useRef<SessionStatus | null>(null);
  const needsBaseline = useRef(true);
  const key = useRef(0);

  useEffect(() => {
    // 斷線：下一份資料可能已經跳過好幾個階段，不能當成「當場看到」
    if (!connected) {
      needsBaseline.current = true;
      setTransition(null);
    }
  }, [connected]);

  useEffect(() => {
    if (status === null) {
      needsBaseline.current = true;
      setTransition(null);
      return;
    }
    if (needsBaseline.current) {
      baseline.current = status;
      needsBaseline.current = false;
      return;
    }
    const from = baseline.current;
    if (from === null || from === status) return;
    baseline.current = status;
    key.current += 1;
    setTransition({ from, to: status, text: textFor(from, status), key: key.current });
  }, [status]);

  return transition;
}
