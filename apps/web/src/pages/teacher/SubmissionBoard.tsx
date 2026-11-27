import type { TeacherView } from '@crs/shared';
import { AnswerLines } from '../../components/AnswerLines';
import { TimeHint } from '../../components/TimeHint';
import { EmptyState } from '../../ui/EmptyState';
import { GroupBadge } from '../../ui/GroupBadge';
import { Icon } from '../../ui/icons';
import { RankMedal } from '../../ui/RankMedal';
import { SectionHeading } from '../../ui/SectionHeading';
import { CARD } from '../../ui/styles';
import { useNewSubmissionHighlight } from '../../ui/useNewSubmissionHighlight';

/**
 * 作答狀況與搶答結果（US3，FR-018、FR-019）：
 * 搶答進行中與結束後都依順位顯示每題所有組別的送出紀錄，搶答成功者有標示；結束後無人作答標示「無人搶答」
 * （002 FR-026：結束後保留所有組別的答案，只有匯出才只輸出搶答成功的答案）。
 * 002：每筆答案後面有時間圖示，可查看提交時間（FR-014）。
 * 004：以「第 N 名」標示順序，答案在名次下方逐子題換行（FR-037）。
 */
export function SubmissionBoard({
  view,
  connected = true,
}: {
  view: TeacherView;
  /** 連線狀態：斷線後收到的第一份資料不播放新送出動態（007 FR-030） */
  connected?: boolean;
}) {
  // 007 FR-030：本分頁當場看到的新送出才滑入並亮起；hook 必須在提早 return 之前呼叫
  const fresh = useNewSubmissionHighlight(view.submissions, connected);

  if (view.status === 'NOT_IMPORTED' || view.status === 'READY') {
    return (
      <section aria-label="作答狀況" className={`space-y-2 ${CARD}`}>
        <SectionHeading icon="submissions">作答狀況</SectionHeading>
        <EmptyState icon="waiting" message="開啟搶答後，這裡會即時顯示各組送出的答案。" />
      </section>
    );
  }

  const closed = view.status === 'CLOSED';
  return (
    <section aria-label="作答狀況" className={`space-y-3 ${CARD}`}>
      <SectionHeading icon={closed ? 'winner' : 'submissions'}>
        {closed ? '搶答結果' : '作答狀況'}
      </SectionHeading>
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
              className="rounded-2xl border-2 border-violet-100 bg-white p-3"
            >
              <h3 className="font-extrabold text-ink">
                第 {question.number} 題
                {isGroup && (
                  <span className="ml-1 rounded-md bg-violet-100 px-1.5 text-xs text-violet-800">
                    （題組）
                  </span>
                )}
              </h3>
              {records.length === 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                  <Icon name={closed ? 'noWinner' : 'empty'} size={16} />
                  {closed ? '無人搶答' : '尚無組別作答'}
                </p>
              ) : (
                <ol className="mt-2 space-y-2 text-sm">
                  {records.map((record, i) => {
                    // 搶答成功組別以伺服器的結果為準（RankingStrategy）；結束後其他組別的答案仍保留顯示（FR-026）
                    const won = record.groupId === result?.winnerGroupId;
                    return (
                      <li
                        key={record.id}
                        className={`min-w-0 space-y-0.5 rounded-lg px-1 ${
                          fresh.has(record.id) ? 'ui-anim animate-slide-in' : ''
                        }`}
                      >
                        {/* 第一行：獎牌、名次、組別、送出者、提交時間與搶答成功標籤（004 FR-037、007 FR-017） */}
                        <div
                          className={won ? 'font-bold text-green-800' : 'font-semibold text-ink'}
                        >
                          <RankMedal rank={i + 1} />第 {i + 1} 名・
                          <GroupBadge groupId={record.groupId} size="sm" />
                          {/* 送出者暱稱（004 FR-026）；004 之前的紀錄沒有送出者時只顯示組別 */}
                          {record.submitterNickname !== null && `・${record.submitterNickname}`}：
                          <TimeHint receivedAt={record.receivedAt} openedAt={view.openedAt} />
                          {won && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-900">
                              <Icon name="winner" size={13} />
                              搶答成功
                            </span>
                          )}
                        </div>
                        <div className={won ? 'text-green-900' : 'text-ink'}>
                          <AnswerLines answers={record.answers} isGroup={isGroup} />
                        </div>
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
