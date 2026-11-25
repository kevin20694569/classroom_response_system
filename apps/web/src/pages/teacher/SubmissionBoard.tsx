import {
  TeacherViewResponseSchema,
  type BlankAnswer,
  type Submission,
  type TeacherView,
} from '@crs/shared';
import { useState } from 'react';
import { ApiError, apiRequest } from '../../api/http';
import { TimeHint } from '../../components/TimeHint';

/** 勾選區旁的使用提示（004 FR-031、contracts/student-ui.md §6）。 */
export const GRADING_HINT =
  '勾選代表該組這一題答對，不勾視為答錯。勾選會立即通知該組答對；按「批改完成」後，沒勾的送出會通知為答錯。' +
  '每題以答對組別中最早送出的為搶答成功，匯出時寫入該組的答案。';

const actionError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.message : fallback;

/**
 * 批改一筆送出（004 FR-031、FR-033）：勾選狀態以伺服器推播為準；送出期間停用，失敗時顯示訊息
 * （勾選框維持伺服器的狀態，等於還原）。
 */
function GradeCheckbox({ record, label }: { record: Submission; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(correct: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/session/grade', TeacherViewResponseSchema, {
        method: 'POST',
        body: { submissionId: record.id, correct },
      });
    } catch (e) {
      setError(actionError(e, '批改失敗，請稍後再試。'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        type="checkbox"
        aria-label={label}
        checked={record.correct}
        disabled={busy}
        onChange={(event) => {
          void toggle(event.target.checked);
        }}
        className="mr-2 h-4 w-4 align-middle"
      />
      {error !== null && (
        <span role="alert" className="ml-2 text-xs text-red-700">
          {error}
        </span>
      )}
    </>
  );
}

/** 批改提示與「批改完成」按鈕（004 FR-031、FR-034）：按下後仍可修改勾選。 */
function GradingPanel({ view }: { view: TeacherView }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finished = view.gradingFinishedAt !== null;

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/session/grade/finish', TeacherViewResponseSchema, {
        method: 'POST',
        body: {},
      });
    } catch (e) {
      setError(actionError(e, '批改完成失敗，請稍後再試。'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md bg-indigo-50 p-3 text-sm text-indigo-900">
      <p>{GRADING_HINT}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || finished}
          onClick={() => void finish()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
        >
          批改完成
        </button>
        {finished && <span className="font-medium">已批改完成（仍可修改勾選）</span>}
        {error !== null && (
          <span role="alert" className="text-red-700">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

function groupLabel(view: TeacherView, groupId: number): string {
  return view.groups.find((g) => g.id === groupId)?.name ?? `第 ${groupId} 組`;
}

function AnswerText({ answers, isGroup }: { answers: readonly BlankAnswer[]; isGroup: boolean }) {
  if (!isGroup) return <span>{answers[0]?.text}</span>;
  return (
    <span className="space-x-3">
      {answers.map((a) => (
        <span key={a.blankIndex}>
          （{a.blankIndex}）{a.text}
        </span>
      ))}
    </span>
  );
}

/**
 * 作答狀況與搶答結果（US3，FR-018、FR-019；004 已結束後可勾選答對並批改完成，FR-031～FR-034）：
 * 搶答進行中與結束後都依順位顯示每題所有組別的送出紀錄，搶答成功者有標示；結束後無人作答標示「無人搶答」
 * （002 FR-026：結束後保留所有組別的答案，只有匯出才只輸出搶答成功的答案）。
 * 002：每筆答案後面有時間圖示，可查看提交時間（FR-014）。
 */
export function SubmissionBoard({ view }: { view: TeacherView }) {
  if (view.status === 'NOT_IMPORTED' || view.status === 'READY') {
    return (
      <section aria-label="作答狀況" className="rounded-xl bg-white p-5 shadow">
        <h2 className="text-lg font-semibold">作答狀況</h2>
        <p className="mt-2 text-sm text-slate-500">開啟搶答後，這裡會即時顯示各組送出的答案。</p>
      </section>
    );
  }

  const closed = view.status === 'CLOSED';
  return (
    <section aria-label="作答狀況" className="space-y-3 rounded-xl bg-white p-5 shadow">
      <h2 className="text-lg font-semibold">{closed ? '搶答結果' : '作答狀況'}</h2>
      {closed && <GradingPanel view={view} />}
      <div className="grid gap-3 md:grid-cols-2">
        {view.questions.map((question) => {
          const isGroup = question.kind === 'group';
          const result = view.results.find((r) => r.questionNumber === question.number);
          const records = view.submissions
            .filter((s) => s.questionNumber === question.number)
            .sort((a, b) => a.sequence - b.sequence);
          return (
            <article
              key={question.number}
              aria-label={`第 ${question.number} 題`}
              className="rounded-lg border border-slate-200 p-3"
            >
              <h3 className="font-medium">
                第 {question.number} 題{isGroup && <span className="ml-1 text-xs">（題組）</span>}
              </h3>
              {records.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  {closed ? '無人搶答' : '尚無組別作答'}
                </p>
              ) : (
                <ol className="mt-2 space-y-1 text-sm">
                  {records.map((record, i) => {
                    // 搶答成功組別以伺服器的結果為準：搶答中為最先送出（暫定），已結束後為答對中最早送出（004 FR-032）；
                    // 結束後其他組別的答案仍保留顯示（FR-026）
                    const won = record.groupId === result?.winnerGroupId;
                    return (
                      <li key={record.id} className={won ? 'font-semibold text-green-700' : ''}>
                        {closed && (
                          <GradeCheckbox
                            record={record}
                            label={`${groupLabel(view, record.groupId)}第 ${question.number} 題答對`}
                          />
                        )}
                        第 {i + 1} 位・{groupLabel(view, record.groupId)}
                        {/* 送出者暱稱（004 FR-026）；004 之前的紀錄沒有送出者時只顯示組別 */}
                        {record.submitterNickname !== null && `・${record.submitterNickname}`}：
                        <AnswerText answers={record.answers} isGroup={isGroup} />
                        <TimeHint receivedAt={record.receivedAt} openedAt={view.openedAt} />
                        {won && (
                          <span className="ml-2 rounded bg-green-100 px-1.5 text-xs">搶答成功</span>
                        )}
                      </li>
                    );
                  })}
                  {closed && result?.winnerGroupId === null && (
                    <li className="text-slate-500">
                      {view.gradingFinishedAt === null ? '尚未勾選答對' : '無人答對'}
                    </li>
                  )}
                </ol>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
