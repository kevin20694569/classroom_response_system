import type { OwnSubmission, SessionStatus, StudentQuestionView } from '@crs/shared';
import { useEffect } from 'react';
import type { StudentIdentity } from '../../api/identity';
import type { InvalidationReason } from '../../hooks/useSessionState';
import * as AnswerDraftStore from '../../student/answerDraftStore';
import { QuestionAnswerForm } from './QuestionAnswerForm';
import { EmptyState } from '../../ui/EmptyState';
import { CARD } from '../../ui/styles';

export interface AnswerSheetProps {
  questions: readonly StudentQuestionView[];
  ownSubmissions: readonly OwnSubmission[];
  status: SessionStatus;
  connected: boolean;
  identity: StudentIdentity;
  onInvalidated: (reason: InvalidationReason) => void;
}

const sectionId = (n: number): string => `question-${n}`;

/** 題號清單點擊後捲到該題，並把焦點移到第一個可輸入的欄位（research R7）。 */
function jumpTo(n: number): void {
  const section = document.getElementById(sectionId(n));
  if (section === null) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  section.querySelector<HTMLInputElement>('input:not([disabled])')?.focus();
}

/**
 * 作答畫面（003 FR-012、FR-013、Clarifications Q4）：所有題目由上到下一次列出，
 * 不需先選題就能作答；上方題號清單顯示本組狀態並可跳到該題。
 */
export function AnswerSheet({
  questions,
  ownSubmissions,
  status,
  connected,
  identity,
  onInvalidated,
}: AnswerSheetProps) {
  const submittedByNumber = new Map(ownSubmissions.map((s) => [s.questionNumber, s]));
  const { activityId, groupId } = identity;

  // 本組已送出的題目（包含同組其他分頁送出的）不再需要草稿（FR-020、research R6）
  useEffect(() => {
    for (const s of ownSubmissions) AnswerDraftStore.clear(activityId, groupId, s.questionNumber);
  }, [ownSubmissions, activityId, groupId]);

  return (
    <div className="space-y-4">
      {status === 'READY' && <EmptyState icon="waiting" message="等待老師開啟搶答" animated />}
      <nav aria-label="題號清單" className="flex flex-wrap gap-2">
        {questions.map((q) => {
          const done = submittedByNumber.has(q.number);
          return (
            <button
              key={q.number}
              type="button"
              onClick={() => {
                jumpTo(q.number);
              }}
              className={`rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 motion-reduce:transform-none ${
                done
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : 'border-violet-200 bg-white text-ink hover:border-violet-400'
              }`}
            >
              第 {q.number} 題 {done ? '已送出' : '未作答'}
            </button>
          );
        })}
      </nav>
      {questions.map((q) => (
        <section
          key={q.number}
          id={sectionId(q.number)}
          aria-label={`第 ${q.number} 題`}
          className={`space-y-3 ${CARD}`}
        >
          {q.content === null && (
            // 「待開始」沒有題目敘述，只顯示題號與題型；有敘述時由 QuestionContent 顯示（004 FR-016）
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
              第 {q.number} 題
              <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-800">
                {q.kind === 'group' ? `題組（${q.blankCount} 子題）` : '單題'}
              </span>
            </h2>
          )}
          <QuestionAnswerForm
            question={q}
            submitted={submittedByNumber.get(q.number) ?? null}
            enabled={status === 'OPEN'}
            canSubmit={connected}
            identity={identity}
            onInvalidated={onInvalidated}
          />
        </section>
      ))}
    </div>
  );
}
