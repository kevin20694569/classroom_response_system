import type { BlankAnswer } from '@crs/shared';

/**
 * 答案逐行顯示（004 FR-037）：題組每個子題一行「（n）答案」，單題一行答案；
 * 長答案在卡片內自動換行（保留原有換行、長字串也會斷行），不同子題不擠在同一行。
 * 007：自 SubmissionBoard 抽出，與老師端結果揭曉共用（FR-029）。
 */
export function AnswerLines({
  answers,
  isGroup,
}: {
  answers: readonly BlankAnswer[];
  isGroup: boolean;
}) {
  const line = 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]';
  if (!isGroup) return <p className={line}>{answers[0]?.text}</p>;
  return (
    <div className="space-y-0.5">
      {answers.map((a) => (
        <p key={a.blankIndex} className={line}>
          （{a.blankIndex}）{a.text}
        </p>
      ))}
    </div>
  );
}
