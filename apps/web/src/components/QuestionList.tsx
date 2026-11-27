import type { TeacherView } from '@crs/shared';
import { useState } from 'react';
import { QuestionPreview } from './QuestionPreview';

/**
 * 預覽切換規則（002 FR-003、FR-004）：點未預覽的題號 → 改為預覽該題；點預覽中的題號 → 關閉預覽。
 * 同一時間最多只有一題在預覽中。
 */
export function togglePreview(current: number | null, clicked: number): number | null {
  return current === clicked ? null : clicked;
}

/**
 * 題號清單與題目預覽（002 US1）：預覽狀態只存在這個老師分頁（FR-007），
 * 不送往伺服器；重新匯入時由上層以 activityId 重新掛載而自動清除（FR-008）。
 */
export function QuestionList({ view }: { view: TeacherView }) {
  const [previewNumber, setPreviewNumber] = useState<number | null>(null);

  if (view.questions.length === 0) {
    return <p className="text-sm text-ink-muted">尚未匯入題目。</p>;
  }
  // 預覽中的題號已不存在（例如題數變少）時視為沒有預覽
  const previewing = view.questions.find((q) => q.number === previewNumber) ?? null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        工作表「{view.source?.sheetTitle}」，共 {view.questions.length} 題、{view.groups.length}{' '}
        組；點題號可預覽題目
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="題號清單">
        {view.questions.map((q) => {
          const active = previewing?.number === q.number;
          return (
            <li key={q.number}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPreviewNumber((current) => togglePreview(current, q.number));
                }}
                className={
                  active
                    ? 'rounded-xl border-2 border-primary bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-900 shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200'
                    : 'rounded-xl border-2 border-violet-100 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-violet-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 motion-reduce:transform-none'
                }
              >
                第 {q.number} 題
                {q.kind === 'group' && (
                  <span className="ml-2 rounded-md bg-amber-100 px-1.5 text-xs font-bold text-amber-900">
                    題組（{q.blankCount} 子題）
                  </span>
                )}
                {/* 不只靠顏色：預覽中另有文字標籤（FR-005） */}
                {active && (
                  <span className="ml-2 rounded-md bg-primary px-1.5 text-xs text-white">
                    預覽中
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite">
        {previewing !== null && (
          <section
            aria-label="題目預覽"
            className="rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-4"
          >
            <QuestionPreview question={previewing} />
          </section>
        )}
      </div>
    </div>
  );
}
