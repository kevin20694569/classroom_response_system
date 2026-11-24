import {
  ANSWER_MAX_LENGTH,
  SubmitResponseSchema,
  unicodeLength,
  type BlankAnswer,
  type OwnSubmission,
  type QuestionSummary,
  type StudentQuestionView,
} from '@crs/shared';
import { useRef, useState, type ReactNode } from 'react';
import { QuestionContent } from '../../components/QuestionContent';
import { ApiError, apiRequest } from '../../api/http';
import type { StudentIdentity } from '../../api/identity';
import type { InvalidationReason } from '../../hooks/useSessionState';
import * as AnswerDraftStore from '../../student/answerDraftStore';
import { blankLabelOf, validateDraft, type SubmitOutcome } from '../../student/validateDraft';

export interface QuestionAnswerFormProps {
  /** content 不為 null（搶答進行中）時以老師端預覽相同的版面顯示題目敘述（004 FR-016、FR-017） */
  question: StudentQuestionView;
  /** 本組已被採計的送出（伺服器推播）；未送出為 null */
  submitted: OwnSubmission | null;
  /** 只有「搶答進行中」可以作答（FR-011） */
  enabled: boolean;
  /** 連線中才可送出（FR-010） */
  canSubmit: boolean;
  identity: StudentIdentity;
  onInvalidated: (reason: InvalidationReason) => void;
}

/** 送出失敗時的畫面訊息（contracts/http-api.md §3、research R8）。 */
const REJECTION_MESSAGE: Partial<Record<string, string>> = {
  SESSION_NOT_OPEN: '搶答已結束，這次送出沒有被採計',
  ALREADY_SUBMITTED: '本組已送出此題',
  NETWORK_ERROR: '無法連線到伺服器，連線恢復後請再送出一次',
};

function inputLabel(question: QuestionSummary, index: number): string {
  const label = blankLabelOf(question, index);
  return label === null ? `第 ${question.number} 題答案` : `第 ${question.number} 題${label}`;
}

/**
 * 題目敘述與每個子題下方的內容（004 research R8）：有敘述時以 QuestionContent 呈現，
 * 每個子題（單題為題目）下方放輸入欄或答案；沒有敘述（「待開始」）時沿用 003 的版面，由呼叫端顯示題號。
 */
function WithContent({
  question,
  renderBlank,
}: {
  question: StudentQuestionView;
  renderBlank: (index: number) => ReactNode;
}) {
  const { content } = question;
  if (content === null) {
    return <>{question.blankLabels.map((_, i) => renderBlank(i + 1))}</>;
  }
  return (
    <QuestionContent
      number={question.number}
      kind={question.kind}
      blankCount={question.blankCount}
      prompt={content.prompt}
      blanks={question.blankLabels.map((label, i) => ({
        label,
        prompt: content.blankPrompts[i] ?? null,
      }))}
      titleAs="h2"
      renderBlank={renderBlank}
    />
  );
}

/**
 * 單題／題組的作答與送出（003 US2）。
 * 每組每題只能送出一次，送出後以唯讀方式顯示本組答案（FR-015）；不顯示順位或是否搶答成功（FR-016）。
 */
export function QuestionAnswerForm({
  question,
  submitted,
  enabled,
  canSubmit,
  identity,
  onInvalidated,
}: QuestionAnswerFormProps) {
  const { activityId, groupId } = identity;
  const [texts, setTexts] = useState<string[]>(() =>
    AnswerDraftStore.load(activityId, groupId, question.number, question.blankCount),
  );
  const [issues, setIssues] = useState<ReadonlyMap<number, string>>(new Map());
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closedHere, setClosedHere] = useState(false);
  const [localSubmitted, setLocalSubmitted] = useState<BlankAnswer[] | null>(null);
  // 以 ref 同步擋下重複點擊：state 更新前的第二次點擊也不會送出（FR-019）
  const submittingRef = useRef(false);

  const editable = enabled && !closedHere;
  const answers = submitted?.answers ?? localSubmitted;

  function change(index: number, value: string) {
    const next = texts.map((t, i) => (i === index - 1 ? value : t));
    setTexts(next);
    AnswerDraftStore.save(activityId, groupId, question.number, next);
    if (issues.has(index)) {
      const rest = new Map(issues);
      rest.delete(index);
      setIssues(rest);
    }
  }

  async function submit(): Promise<SubmitOutcome> {
    if (submittingRef.current || !editable || !canSubmit) return { kind: 'IGNORED' };
    const draftIssues = validateDraft(question, texts);
    if (draftIssues.length > 0) {
      setIssues(new Map(draftIssues.map((i) => [i.blankIndex, i.message])));
      setMessage(null);
      return { kind: 'INVALID_DRAFT', issues: draftIssues };
    }
    submittingRef.current = true;
    setSubmitting(true);
    setMessage(null);
    const cleaned = texts.map((text, i) => ({ blankIndex: i + 1, text: text.trim() }));
    try {
      await apiRequest('/api/submissions', SubmitResponseSchema, {
        method: 'POST',
        body: { questionNumber: question.number, answers: cleaned },
      });
      AnswerDraftStore.clear(activityId, groupId, question.number);
      setLocalSubmitted(cleaned);
      return { kind: 'SUBMITTED', answers: cleaned };
    } catch (error) {
      const e =
        error instanceof ApiError
          ? error
          : new ApiError('INTERNAL_ERROR', '系統發生錯誤，請稍後再試。');
      if (e.code === 'UNAUTHORIZED') {
        onInvalidated('EXPIRED');
      } else {
        if (e.code === 'SESSION_NOT_OPEN') setClosedHere(true);
        // 同組其他分頁已送出：本組答案以伺服器推播為準，草稿不再需要
        if (e.code === 'ALREADY_SUBMITTED') {
          AnswerDraftStore.clear(activityId, groupId, question.number);
        }
        setMessage(REJECTION_MESSAGE[e.code] ?? e.message);
        setIssues(
          new Map(
            e.details
              .filter((d) => d.blankIndex !== undefined)
              .map((d) => [d.blankIndex ?? 0, d.message]),
          ),
        );
      }
      return { kind: 'REJECTED', code: e.code, message: e.message, details: e.details };
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // 有題目敘述時子題標記已顯示在敘述旁，輸入欄與答案前不再重複
  const showLabels = question.content === null;

  if (answers !== null) {
    // 同組成員都看得到送出者（004 FR-024）；本分頁剛送出、推播尚未到達時以自己的暱稱顯示
    const submitter = submitted === null ? identity.nickname : submitted.submitterNickname;
    const byIndex = new Map(answers.map((a) => [a.blankIndex, a.text]));
    return (
      <div className="space-y-2">
        <p className="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
          {submitter === null ? '已送出' : `已送出（${submitter}）`}
        </p>
        <WithContent
          question={question}
          renderBlank={(index) => {
            const text = byIndex.get(index);
            if (text === undefined) return null;
            const label = showLabels ? blankLabelOf(question, index) : null;
            return (
              <p key={index} className="flex gap-2 text-base">
                {label !== null && <span className="text-slate-500">{label}</span>}
                <span>{text}</span>
              </p>
            );
          }}
        />
        {message !== null && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <WithContent
        question={question}
        renderBlank={(index) => {
          const text = texts[index - 1] ?? '';
          const label = showLabels ? blankLabelOf(question, index) : null;
          const issue = issues.get(index);
          return (
            <div key={index} className="space-y-1 text-base">
              <div className="flex items-center gap-2">
                {label !== null && <span className="w-10 shrink-0 text-slate-500">{label}</span>}
                <input
                  type="text"
                  aria-label={inputLabel(question, index)}
                  aria-invalid={issue !== undefined}
                  value={text}
                  disabled={!editable}
                  onChange={(event) => {
                    change(index, event.target.value);
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                />
                <span className="w-16 shrink-0 text-right text-xs text-slate-500">
                  {unicodeLength(text.trim())}／{ANSWER_MAX_LENGTH}
                </span>
              </div>
              {issue !== undefined && <p className="text-sm text-red-700">{issue}</p>}
            </div>
          );
        }}
      />
      {message !== null && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={!editable || !canSubmit || submitting}
        className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? '送出中…' : '送出'}
      </button>
    </form>
  );
}
