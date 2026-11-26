import type { MemberAnswerTag } from '@crs/shared';

/** 膠囊共用樣式：內容垂直置中、左右留白相同，有無「★」時高度一致。 */
const PILL = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs leading-5';

/**
 * 組員送出過的題號（006 FR-007、FR-010、contracts/teacher-ui.md）：依題號排列，多題時自動換行（FR-015）。
 * 搶答成功的題號以醒目樣式、「★」、title 與螢幕閱讀器可讀的文字標示，不只靠顏色辨識。
 */
export function MemberAnswerTags({ tags }: { tags: readonly MemberAnswerTag[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) =>
        tag.isWinner ? (
          <li
            key={tag.questionNumber}
            title="搶答成功"
            className={`${PILL} gap-1 bg-amber-100 font-medium text-amber-800`}
          >
            {/* 星號與文字之間固定間距（gap-1），不貼字 */}
            <span aria-hidden="true" className="leading-none">
              ★
            </span>
            <span>第 {tag.questionNumber} 題</span>
            <span className="sr-only">（搶答成功）</span>
          </li>
        ) : (
          <li key={tag.questionNumber} className={`${PILL} bg-slate-100 text-slate-600`}>
            第 {tag.questionNumber} 題
          </li>
        ),
      )}
    </ul>
  );
}
