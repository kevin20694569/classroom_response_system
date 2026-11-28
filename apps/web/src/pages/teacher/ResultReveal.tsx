import type { TeacherView } from '@crs/shared';
import { useEffect, useId, useRef } from 'react';
import { AnswerLines } from '../../components/AnswerLines';
import { Button } from '../../ui/Button';
import { GroupBadge } from '../../ui/GroupBadge';
import { Icon } from '../../ui/icons';

/** 對話框內可以取得焦點的元素 */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * 老師端「結果揭曉」（007 FR-029、contracts/ui-effects.md §7）：搶答結束時投影給全班看。
 * 依題號列出每題搶答成功的組別、送出者暱稱與答案（排版沿用送出列表）；無人送出顯示「本題無人搶答」。
 * 只用老師已經拿到的 TeacherView.results，不新增任何資料（FR-027）。何時開啟由 TeacherDashboard 決定。
 */
export function ResultReveal({ view, onClose }: { view: TeacherView; onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // 鍵盤（FR-024、contracts/ui-effects.md §7）：Esc 在整個頁面都能關閉（焦點不在對話框內也一樣）；
  // Tab／Shift+Tab 只在對話框內循環，不會跑到被遮住的主畫面
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || dialogRef.current === null) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute('disabled'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      const inside = active instanceof Node && dialogRef.current.contains(active);
      if (!inside || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ui-card ui-anim flex max-h-[88vh] w-full max-w-2xl animate-pop-in flex-col p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-3 text-3xl font-black text-ink">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white">
              <Icon name="winner" size={28} />
            </span>
            結果揭曉
          </h2>
          <Button ref={closeRef} variant="secondary" onClick={onClose}>
            關閉
          </Button>
        </div>
        <ol className="mt-4 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {view.questions.map((question) => {
            const result = view.results.find((r) => r.questionNumber === question.number);
            const winner = result?.winnerGroupId ?? null;
            return (
              <li
                key={question.number}
                aria-label={`第 ${String(question.number)} 題`}
                className="rounded-2xl border-2 border-violet-100 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold text-ink">第 {question.number} 題</span>
                  {winner !== null && (
                    <>
                      <GroupBadge groupId={winner} />
                      {result !== undefined && result.submitterNickname !== null && (
                        <span className="font-bold break-words text-ink [overflow-wrap:anywhere]">
                          {result.submitterNickname}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {winner === null || result === undefined || result.answers === null ? (
                  <p className="mt-1 flex items-center gap-1.5 text-ink-muted">
                    <Icon name="noWinner" size={16} />
                    本題無人搶答
                  </p>
                ) : (
                  <div className="mt-1 text-base text-ink">
                    <AnswerLines answers={result.answers} isGroup={question.kind === 'group'} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
