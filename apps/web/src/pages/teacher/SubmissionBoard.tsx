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
                    // 搶答成功組別以伺服器的結果為準（RankingStrategy）；結束後其他組別的答案仍保留顯示（FR-026）
                    const won = record.groupId === result?.winnerGroupId;
                    return (
                      <li key={record.id} className={won ? 'font-semibold text-green-700' : ''}>
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
                </ol>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
