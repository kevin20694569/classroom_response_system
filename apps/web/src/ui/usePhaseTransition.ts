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

/** 伺服器推來的檢視資料：只用到階段；每次推播都是新的物件。 */
export interface PhaseSource {
  status: SessionStatus;
}

/**
 * 判斷「本分頁當場看到的階段變化」（007 FR-014、FR-019、FR-029，research R6）：
 * 以本分頁上一次看到的階段為 baseline，並以伺服器推來的 view 物件為單位判斷。
 * 第一份資料、view 為 null（連線中、身分剛改變），或斷線後收到的第一份「新的」view 只建立 baseline，
 * 不算變化——所以重新整理、重連都不會重播提示、慶祝或結果揭曉。
 * （重新連線時 connected 先變回 true，但畫面上還是斷線前的 view；要等新的 view 才建立 baseline。）
 * 只存在元件記憶中，不寫入任何 storage。
 */
export function usePhaseTransition(
  view: PhaseSource | null,
  connected: boolean,
): PhaseTransition | null {
  const [transition, setTransition] = useState<PhaseTransition | null>(null);
  const baseline = useRef<SessionStatus | null>(null);
  const needsBaseline = useRef(true);
  const key = useRef(0);

  useEffect(() => {
    // 斷線：下一份資料可能已經跳過好幾個階段，不能當成「當場看到」。
    // 已經出現的效果（例如老師正在看的結果揭曉）不因短暫斷線而收掉，所以這裡不清除 transition
    if (!connected) needsBaseline.current = true;
  }, [connected]);

  useEffect(() => {
    if (view === null) {
      // 畫面換成「連線中…」或身分改變：清除上一筆變化，避免重新掛載的提示重播
      needsBaseline.current = true;
      setTransition(null);
      return;
    }
    if (needsBaseline.current) {
      baseline.current = view.status;
      needsBaseline.current = false;
      return;
    }
    const from = baseline.current;
    if (from === null || from === view.status) return;
    baseline.current = view.status;
    key.current += 1;
    setTransition({ from, to: view.status, text: textFor(from, view.status), key: key.current });
  }, [view]);

  return transition;
}
