import { useEffect, useRef, useState } from 'react';

const EMPTY: ReadonlySet<string> = new Set();

/**
 * 老師端新送出動態（007 data-model §5、FR-030）：回傳「本分頁當場看到才出現」的送出 id。
 * 第一份清單（首次載入、重新整理）與斷線後的第一份清單都視為已看過，不播放滑入。
 * 已標記的 id 維持標記，列不會因為重新渲染而重播動畫（CSS 動畫只在 class 第一次加上時播放）。
 */
export function useNewSubmissionHighlight(
  submissions: readonly { id: string }[],
  connected: boolean,
): ReadonlySet<string> {
  const [fresh, setFresh] = useState<ReadonlySet<string>>(EMPTY);
  // null 代表下一份清單只建立 baseline
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!connected) seen.current = null;
  }, [connected]);

  // 以伺服器推來的送出陣列為單位：重新連線時畫面上還是舊陣列，要等新的陣列才建立 baseline
  useEffect(() => {
    const ids = submissions.map((s) => s.id);
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const known = seen.current;
    const added = ids.filter((id) => !known.has(id));
    if (added.length === 0) return;
    for (const id of added) known.add(id);
    // 同一次推播帶來的多筆一起標記，不排隊
    setFresh((previous) => new Set([...previous, ...added]));
  }, [submissions]);

  return fresh;
}
