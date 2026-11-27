/**
 * 007 共用的 class 組合（contracts/ui-visual.md §2）：讓各畫面的卡片、輸入欄、說明文字一致，
 * 顏色只取自 index.css 的 @theme token。
 */

/** 內容卡片：白底、大圓角、柔和陰影（FR-003） */
export const CARD = 'ui-card p-5 sm:p-6';

/** 輸入欄：圓角、彩色外框，鍵盤焦點有明顯外框（FR-024） */
export const INPUT =
  'mt-1 w-full rounded-xl border-2 border-violet-200 bg-white px-3 py-2 text-ink transition ' +
  'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 ' +
  'focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:bg-slate-100';

/** 次要說明文字 */
export const MUTED = 'text-sm text-ink-muted';

/** 操作成功的提示文字 */
export const SUCCESS_TEXT = 'text-sm font-semibold text-green-800';
