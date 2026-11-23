import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatClock, formatElapsed } from '../utils/timeFormat';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const GAP = 6;
const MARGIN = 4;

/**
 * 小視窗位置（002 FR-016）：預設放在按鈕上方置中；上方空間不足時改放下方；
 * 水平位置夾在可視範圍內，確保小視窗完整顯示、不被截掉。
 */
export function computeTooltipPosition(
  anchor: Rect,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const above = anchor.top - GAP - tooltip.height;
  const top = above >= MARGIN ? above : anchor.top + anchor.height + GAP;
  const centered = anchor.left + anchor.width / 2 - tooltip.width / 2;
  const maxLeft = Math.max(MARGIN, viewport.width - tooltip.width - MARGIN);
  const left = Math.min(Math.max(centered, MARGIN), maxLeft);
  return { top: Math.min(top, Math.max(MARGIN, viewport.height - tooltip.height - MARGIN)), left };
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 提交時間提示（002 US3，research R6）：答案後的小時間圖示，滑鼠移入或鍵盤聚焦時浮出小視窗，
 * 顯示提交時間（伺服器收件時間）與距開始搶答的經過時間；移出、失焦或按 Esc 關閉。
 * 小視窗以 Portal 渲染、固定定位，浮在內容上方，不推擠版面。
 */
export function TimeHint({
  receivedAt,
  openedAt,
}: {
  receivedAt: string;
  openedAt: string | null;
}) {
  const id = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || anchorRef.current === null || tooltipRef.current === null) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    setPosition(
      computeTooltipPosition(anchor, tooltip, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
  }, [open]);

  const show = () => {
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
  };
  const elapsed = openedAt === null ? null : Date.parse(receivedAt) - Date.parse(openedAt);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label="查看提交時間"
        aria-describedby={open ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(event) => {
          if (event.key === 'Escape') hide();
        }}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <ClockIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            style={{ position: 'fixed', top: position.top, left: position.left }}
            className="pointer-events-none z-50 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
          >
            <div>提交時間 {formatClock(receivedAt)}</div>
            {elapsed !== null && <div>開始後 {formatElapsed(elapsed)}</div>}
          </div>,
          document.body,
        )}
    </>
  );
}
