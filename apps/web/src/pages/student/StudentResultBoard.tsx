import {
  groupName,
  type BlankAnswer,
  type OwnSubmission,
  type QuestionSummary,
  type ResultView,
  type StudentQuestionView,
} from '@crs/shared';
import { QuestionContent } from '../../components/QuestionContent';
import { groupOutcomes, wonCount, type OutcomeKind } from '../../student/groupOutcomes';
import { blankLabelOf } from '../../student/validateDraft';

export interface StudentResultBoardProps {
  questions: readonly StudentQuestionView[];
  /** 每題結果；老師「批改完成」前為 null（004 FR-025） */
  results: readonly ResultView[] | null;
  ownSubmissions: readonly OwnSubmission[];
  groupId: number;
  /** 結束時該分頁還有未送出的內容（FR-018） */
  showUnsentNotice: boolean;
}

/** 本組每題的標籤（004 FR-033、FR-034、contracts/student-ui.md §5a）。 */
const OUTCOME_LABEL: Readonly<Record<OutcomeKind, string>> = {
  PENDING: '等待老師批改',
  CORRECT: '答對',
  WON: '本組搶答成功',
  ANSWERED_CORRECT: '回答成功',
  INCORRECT: '答錯',
  NOT_SUBMITTED: '本組未作答',
};

const OUTCOME_STYLE: Readonly<Record<OutcomeKind, string>> = {
  PENDING: 'bg-amber-50 text-amber-800',
  CORRECT: 'bg-green-100 text-green-800',
  WON: 'bg-green-100 text-green-800',
  ANSWERED_CORRECT: 'bg-emerald-50 text-emerald-800',
  INCORRECT: 'bg-red-50 text-red-800',
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
 * 結果畫面（003 US3；004 依老師批改）：批改完成前顯示本組每題的批改狀態與本組答案；
 * 批改完成後顯示每題的搶答成功組別與答案、本組成績與搶答成功題數。
 * 只顯示伺服器提供的搶答成功答案與本組答案，不顯示其他組未搶到的答案、順序或時間。
 */
export function StudentResultBoard({
  questions,
  results,
  ownSubmissions,
  groupId,
  showUnsentNotice,
}: StudentResultBoardProps) {
  const outcomes = groupOutcomes(
    questions.map((q) => q.number),
    results,
    ownSubmissions,
    groupId,
  );
  const finished = results !== null;
  const questionByNumber = new Map(questions.map((q) => [q.number, q]));

  return (
    <div className="space-y-4">
      {showUnsentNotice && (
        <p role="status" className="rounded-md bg-amber-50 p-3 text-amber-800">
          搶答已結束，尚未送出的答案不會被採計
        </p>
      )}
      {finished ? (
        <p className="text-lg font-semibold">本組搶答成功 {wonCount(outcomes)} 題</p>
      ) : (
        <p role="status" className="rounded-md bg-slate-100 p-3 text-slate-700">
          老師批改中，結果會即時更新
        </p>
      )}
      {outcomes.map((outcome) => {
        const question = questionByNumber.get(outcome.questionNumber);
        const content = question?.content ?? null;
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
            {!finished ? null : outcome.winnerGroupId === null || outcome.winnerAnswers === null ? (
              <p className="text-slate-500">無人答對</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-slate-500">
                  搶答成功：{groupName(outcome.winnerGroupId)}
                  {/* 批改完成後所有學生都看得到搶答成功答案的送出者（004 FR-025） */}
                  {outcome.winnerSubmitter !== null && `・${outcome.winnerSubmitter}`}
                </p>
                <AnswerList question={question} answers={outcome.winnerAnswers} />
              </div>
            )}
            {outcome.kind !== 'WON' && outcome.ownAnswers !== null && (
              <div className="space-y-1 border-t border-slate-100 pt-2">
                <p className="text-sm text-slate-500">
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
