import type { TeacherQuestionView } from '@crs/shared';

export const NO_PROMPT_TEXT = '文件未提供題目敘述';

function PromptText({ text }: { text: string | null }) {
  return text === null ? (
    <span className="text-slate-400">{NO_PROMPT_TEXT}</span>
  ) : (
    // 完整顯示並保留原有換行，不截斷（002 FR-006）
    <span className="whitespace-pre-wrap">{text}</span>
  );
}

/**
 * 題目預覽內容（002 FR-006）：題號、題型與題目敘述；題組依序列出題組說明與每個子題。
 * 子題沒有「（n）」標記時以「（序號）」呈現。
 */
export function QuestionPreview({ question }: { question: TeacherQuestionView }) {
  const isGroup = question.kind === 'group';
  return (
    <div className="space-y-2">
      <p className="font-medium">
        第 {question.number} 題
        <span className="ml-2 text-sm text-slate-600">
          {isGroup ? `題組（${String(question.blankCount)} 子題）` : '單題'}
        </span>
      </p>
      {!isGroup ? (
        <p className="text-sm">
          <PromptText text={question.prompt} />
        </p>
      ) : (
        <>
          {question.prompt !== null && (
            <p className="text-sm">
              <PromptText text={question.prompt} />
            </p>
          )}
          <ol className="space-y-1 text-sm">
            {question.blanks.map((blank) => (
              <li key={blank.index} className="flex gap-1">
                <span className="shrink-0 font-medium">
                  {blank.label ?? `（${String(blank.index)}）`}
                </span>
                <PromptText text={blank.prompt} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
