import {
  groupName,
  type BlankAnswer,
  type OwnSubmission,
  type QuestionSummary,
  type ResultView,
} from '@crs/shared';
import { groupOutcomes, wonCount, type OutcomeKind } from '../../student/groupOutcomes';
import { blankLabelOf } from '../../student/validateDraft';

export interface StudentResultBoardProps {
  questions: readonly QuestionSummary[];
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
        <p role="status" className="rounded-md bg-amber-50 p-3 text-amber-800">
          搶答已結束，尚未送出的答案不會被採計
        </p>
      )}
      <p className="text-lg font-semibold">本組搶答成功 {wonCount(outcomes)} 題</p>
      {outcomes.map((outcome) => {
        const question = questionByNumber.get(outcome.questionNumber);
        return (
          <section
            key={outcome.questionNumber}
            aria-label={`第 ${outcome.questionNumber} 題結果`}
            className="space-y-2 rounded-xl bg-white p-4 shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">第 {outcome.questionNumber} 題</h2>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${OUTCOME_STYLE[outcome.kind]}`}
              >
                {OUTCOME_LABEL[outcome.kind]}
              </span>
            </div>
            {outcome.winnerGroupId === null || outcome.winnerAnswers === null ? (
              <p className="text-slate-500">無人搶答</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-slate-500">
                  搶答成功：{groupName(outcome.winnerGroupId)}
                </p>
                <AnswerList question={question} answers={outcome.winnerAnswers} />
              </div>
            )}
            {outcome.kind === 'SUBMITTED_NOT_WON' && outcome.ownAnswers !== null && (
              <div className="space-y-1 border-t border-slate-100 pt-2">
                <p className="text-sm text-slate-500">本組答案</p>
                <AnswerList question={question} answers={outcome.ownAnswers} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
