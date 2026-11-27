import {
  groupName,
  type BlankAnswer,
  type OwnSubmission,
  type QuestionSummary,
  type ResultView,
  type StudentQuestionView,
} from '@crs/shared';
import { QuestionContent } from '../../components/QuestionContent';
import { GroupBadge } from '../../ui/GroupBadge';
import { groupIdentity } from '../../ui/groupIdentity';
import { CARD } from '../../ui/styles';
import { groupOutcomes, wonCount, type OutcomeKind } from '../../student/groupOutcomes';
import { blankLabelOf } from '../../student/validateDraft';

export interface StudentResultBoardProps {
  questions: readonly StudentQuestionView[];
  results: readonly ResultView[];
  ownSubmissions: readonly OwnSubmission[];
  groupId: number;
  /** 結束時該分頁還有未送出的內容（FR-018） */
  showUnsentNotice: boolean;
}

const OUTCOME_LABEL: Readonly<Record<OutcomeKind, string>> = {
  WON: '本組搶答成功',
  SUBMITTED_NOT_WON: '已送出，未搶到',
  NOT_SUBMITTED: '本組未作答',
};

const OUTCOME_STYLE: Readonly<Record<OutcomeKind, string>> = {
  WON: 'bg-green-100 text-green-800',
  SUBMITTED_NOT_WON: 'bg-amber-100 text-amber-800',
  NOT_SUBMITTED: 'bg-slate-100 text-slate-600',
};

function AnswerList({
  question,
  answers,
}: {
  question: QuestionSummary | undefined;
  answers: readonly BlankAnswer[];
}) {
  return (
    <ul className="space-y-1">
      {answers.map((answer) => {
        const label = question === undefined ? null : blankLabelOf(question, answer.blankIndex);
        return (
          <li key={answer.blankIndex} className="flex gap-2">
            {label !== null && <span className="text-slate-500">{label}</span>}
            <span>{answer.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 結果畫面（003 US3）：每題的搶答成功組別與答案、本組成績與搶答成功題數。
 * 只顯示伺服器提供的搶答成功答案與本組答案，不顯示其他組未搶到的答案、順序或時間。
 */
export function StudentResultBoard({
  questions,
  results,
  ownSubmissions,
  groupId,
  showUnsentNotice,
}: StudentResultBoardProps) {
  const outcomes = groupOutcomes(results, ownSubmissions, groupId);
  const questionByNumber = new Map(questions.map((q) => [q.number, q]));

  return (
    <div className="space-y-4">
      {showUnsentNotice && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">
          搶答已結束，尚未送出的答案不會被採計
        </p>
      )}
      <p className="text-2xl font-black text-ink">本組搶答成功 {wonCount(outcomes)} 題</p>
      {outcomes.map((outcome) => {
        const question = questionByNumber.get(outcome.questionNumber);
        const content = question?.content ?? null;
        return (
          <section
            key={outcome.questionNumber}
            aria-label={`第 ${outcome.questionNumber} 題結果`}
            // 本組搶到的題目，卡片左側為本組顏色邊條（007 contracts/ui-visual.md §3）
            {...(outcome.kind === 'WON' && {
              style: { borderLeftColor: groupIdentity(groupId).color },
            })}
            className={`space-y-2 ${CARD}${outcome.kind === 'WON' ? ' border-l-8' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-ink">第 {outcome.questionNumber} 題</h2>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${OUTCOME_STYLE[outcome.kind]}`}
              >
                {OUTCOME_LABEL[outcome.kind]}
              </span>
            </div>
            {question !== undefined && content !== null && (
              // 已結束時每題結果旁一併顯示題目敘述（004 FR-016、contracts/student-ui.md §5）
              <QuestionContent
                number={question.number}
                kind={question.kind}
                blankCount={question.blankCount}
                prompt={content.prompt}
                blanks={question.blankLabels.map((label, i) => ({
                  label,
                  prompt: content.blankPrompts[i] ?? null,
                }))}
                hideTitle
              />
            )}
            {outcome.winnerGroupId === null || outcome.winnerAnswers === null ? (
              <p className="text-ink-muted">無人搶答</p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  {/* 組別識別：顏色＋圖示的標記，組名在旁邊的文字中（007 FR-009） */}
                  <GroupBadge groupId={outcome.winnerGroupId} size="sm" showName={false} />
                  <p>
                    搶答成功：{groupName(outcome.winnerGroupId)}
                    {/* 結束後所有學生都看得到搶答成功答案的送出者（004 FR-025） */}
                    {outcome.winnerSubmitter !== null && `・${outcome.winnerSubmitter}`}
                  </p>
                </div>
                <AnswerList question={question} answers={outcome.winnerAnswers} />
              </div>
            )}
            {outcome.kind === 'SUBMITTED_NOT_WON' && outcome.ownAnswers !== null && (
              <div className="space-y-1 border-t border-violet-100 pt-2">
                <p className="text-sm font-bold text-ink-muted">
                  {outcome.ownSubmitter === null ? '本組答案' : `本組（${outcome.ownSubmitter}）`}
                </p>
                <AnswerList question={question} answers={outcome.ownAnswers} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
