import type { QuestionKind } from '@crs/shared';
import type { ReactNode } from 'react';

export const NO_PROMPT_TEXT = '文件未提供題目敘述';

/** 子題：標記原文（沒有時為 null）與子題敘述。 */
export interface QuestionContentBlank {
  label: string | null;
  prompt: string | null;
}

export interface QuestionContentProps {
  number: number;
  kind: QuestionKind;
  blankCount: number;
  /** 題目敘述（單題）或題組說明（題組）；文件沒有時為 null */
  prompt: string | null;
  /** 依子題序號排列 */
  blanks: readonly QuestionContentBlank[];
  /** 題號列的元素：老師端預覽為段落，學生端作答畫面為標題 */
  titleAs?: 'p' | 'h2';
  /** 不顯示題號列（學生端結果畫面已有自己的題號列） */
  hideTitle?: boolean;
  /** 在每個子題（單題為題目）下方插入的內容，例如學生的輸入欄或答案；index 從 1 起算 */
  renderBlank?: (index: number) => ReactNode;
}

function PromptText({ text }: { text: string | null }) {
  return text === null ? (
    <span className="text-slate-400">{NO_PROMPT_TEXT}</span>
  ) : (
    // 完整顯示並保留原有換行，不截斷（002 FR-006、004 FR-017）
    <span className="whitespace-pre-wrap">{text}</span>
  );
}

/**
 * 題目版面（002 FR-006、004 FR-017、research R8）：題號、題型與題目敘述；題組依序列出題組說明與每個子題。
 * 子題沒有「（n）」標記時以「（序號）」呈現。老師端預覽與學生端作答／結果共用，確保兩邊版面一致。
 */
export function QuestionContent({
  number,
  kind,
  blankCount,
  prompt,
  blanks,
  titleAs = 'p',
  hideTitle = false,
  renderBlank,
}: QuestionContentProps) {
  const isGroup = kind === 'group';
  const Title = titleAs;
  return (
    <div className="space-y-2">
      {!hideTitle && (
        <Title className={titleAs === 'h2' ? 'text-lg font-semibold' : 'font-medium'}>
          第 {number} 題
          <span className="ml-2 text-sm font-normal text-slate-600">
            {isGroup ? `題組（${String(blankCount)} 子題）` : '單題'}
          </span>
        </Title>
      )}
      {!isGroup ? (
        <>
          <p className="text-sm">
            <PromptText text={prompt} />
          </p>
          {renderBlank?.(1)}
        </>
      ) : (
        <>
          {prompt !== null && (
            <p className="text-sm">
              <PromptText text={prompt} />
            </p>
          )}
          <ol className="space-y-1 text-sm">
            {blanks.map((blank, i) => {
              const index = i + 1;
              return (
                <li key={index} className="space-y-1">
                  <div className="flex gap-1">
                    <span className="shrink-0 font-medium">
                      {blank.label ?? `（${String(index)}）`}
                    </span>
                    <PromptText text={blank.prompt} />
                  </div>
                  {renderBlank?.(index)}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
