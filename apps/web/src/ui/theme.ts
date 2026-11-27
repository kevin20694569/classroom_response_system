import type { SessionStatus } from '@crs/shared';

/**
 * 007 依資料切換的顏色（research R1、R2、R7）。這裡是唯一來源：元件以 inline style／CSS 變數套用，
 * 單元測試（tests/theme.test.ts）直接用這些值計算對比，確保 FR-024 的 4.5:1 是自動化檢查。
 * 全站共用的靜態顏色（背景、內文、按鈕）定義在 index.css 的 @theme。
 */

/** 組別色：第 n 組用 GROUP_COLORS[(n − 1) mod 10]；每色對白字 ≥ 4.5:1，可當頂端列、徽章、按鈕的底色。 */
export const GROUP_COLORS = [
  '#be123c', // rose
  '#c2410c', // orange
  '#b45309', // amber
  '#4d7c0f', // lime
  '#047857', // emerald
  '#0f766e', // teal
  '#0e7490', // cyan
  '#1d4ed8', // blue
  '#6d28d9', // violet
  '#a21caf', // fuchsia
] as const;

/** 階段強調色：四階段兩兩不同，對白底 ≥ 4.5:1（階段標籤是白底＋階段色字，FR-010、FR-011）。 */
export const PHASE_COLORS: Readonly<Record<SessionStatus, string>> = {
  NOT_IMPORTED: '#475569',
  READY: '#b45309',
  OPEN: '#15803d',
  CLOSED: '#4338ca',
};

/** 第 1～3 名的金、銀、銅（FR-017）；對白底 ≥ 4.5:1，並一律搭配「第 N 名」文字，不只靠顏色。 */
export const MEDAL_COLORS = {
  gold: '#a16207',
  silver: '#64748b',
  bronze: '#9a3412',
} as const;

/** 放在彩色底上的文字與圖示顏色。 */
export const ON_COLOR = '#ffffff';
