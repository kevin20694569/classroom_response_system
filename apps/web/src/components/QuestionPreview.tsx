import type { TeacherQuestionView } from '@crs/shared';
import { QuestionContent } from './QuestionContent';

export { NO_PROMPT_TEXT } from './QuestionContent';

/**
 * 題目預覽內容（002 FR-006）：題號、題型與題目敘述；題組依序列出題組說明與每個子題。
 * 版面由 QuestionContent 提供，學生端顯示題目敘述時共用同一個版面（004 FR-017）。
 */
export function QuestionPreview({ question }: { question: TeacherQuestionView }) {
  return (
    <QuestionContent
      number={question.number}
      kind={question.kind}
      blankCount={question.blankCount}
      prompt={question.prompt}
      blanks={question.blanks}
    />
  );
}
