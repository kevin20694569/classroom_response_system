import type { TeacherView } from '@crs/shared';
import { useEffect, useRef, useState } from 'react';
import { GroupOverviewPanel } from './GroupOverviewPanel';

/**
 * 窄視窗（< 1600 px）的「分組情況」（006 FR-012、research R6、contracts/teacher-ui.md）：
 * 固定在視窗右上角的浮動按鈕，捲動到任何位置都看得到；按下後從右側展開抽屜，內容與寬螢幕側欄相同。
 * 「關閉」按鈕、點背景、按 Esc 都能關閉；開啟時焦點移到「關閉」，關閉後回到浮動按鈕。
 * 展開狀態只存在這個元件：變成寬版面時本元件卸載，再變窄或重新整理都回到收合。
 */
export function GroupOverviewToggle({ view }: { view: TeacherView }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) toggleRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        className="fixed top-4 right-4 z-30 w-20 rounded-lg bg-indigo-600 px-2 py-2 text-sm font-medium text-white shadow-lg hover:bg-indigo-700"
        onClick={() => {
          setOpen(true);
        }}
      >
        分組情況
      </button>
      {open && (
        <>
          <div
            data-testid="group-overview-backdrop"
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-slate-900/30"
            onClick={() => {
              setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="分組情況"
            className="fixed inset-y-0 right-0 z-50 w-[min(22rem,100vw)] overflow-y-auto overscroll-contain bg-white p-5 shadow-xl"
          >
            <div className="mb-2 flex justify-end">
              <button
                ref={closeRef}
                type="button"
                className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setOpen(false);
                }}
              >
                關閉
              </button>
            </div>
            <GroupOverviewPanel view={view} />
          </div>
        </>
      )}
    </>
  );
}
