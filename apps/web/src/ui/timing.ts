/**
 * 007 回饋效果的時間（data-model §4、contracts/ui-effects.md）。元件不得自行寫死毫秒數。
 */

/** 切換提示顯示多久（FR-013：2 秒內自動消失）。慶祝效果與結果揭曉在提示消失後才出現。 */
export const PHASE_TOAST_MS = 1800;

/** 學生端慶祝紙片播放多久（FR-019：開始後 3 秒內結束）。 */
export const CELEBRATION_MS = 2800;

/** 老師端新送出滑入並亮起的動畫長度（FR-030：1 秒內結束），需與 index.css 的 slide-in 一致。 */
export const NEW_SUBMISSION_HIGHLIGHT_MS = 900;

/** 恢復連線後「已重新連線」顯示多久（FR-021：短暫顯示後自動消失）。 */
export const RECONNECTED_NOTICE_MS = 2000;
