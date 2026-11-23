import type { BlankAnswer, TeacherView } from '@crs/shared';
import { TimeHint } from '../../components/TimeHint';

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
 * 作答狀況與搶答結果（US3，FR-018、FR-019）：
 * 搶答進行中顯示每題送出紀錄與順位（順位第一為搶答成功）；結束後顯示每題結果，無人作答標示「無人搶答」。
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
              {closed ? (
                result?.winnerGroupId != null && result.answers !== null ? (
                  <p className="mt-2 text-sm">
                    <span className="font-semibold text-green-700">
                      {groupLabel(view, result.winnerGroupId)}
                    </span>
                    ：<AnswerText answers={result.answers} isGroup={isGroup} />
                    {result.receivedAt !== null && (
                      <TimeHint receivedAt={result.receivedAt} openedAt={view.openedAt} />
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">無人搶答</p>
                )
              ) : records.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">尚無組別作答</p>
              ) : (
                <ol className="mt-2 space-y-1 text-sm">
                  {records.map((record, i) => (
                    <li key={record.id} className={i === 0 ? 'font-semibold text-green-700' : ''}>
                      第 {i + 1} 位・{groupLabel(view, record.groupId)}：
                      <AnswerText answers={record.answers} isGroup={isGroup} />
                      <TimeHint receivedAt={record.receivedAt} openedAt={view.openedAt} />
                      {i === 0 && (
                        <span className="ml-2 rounded bg-green-100 px-1.5 text-xs">搶答成功</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
