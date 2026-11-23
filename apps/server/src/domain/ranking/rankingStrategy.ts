import type { Submission } from '@crs/shared';

/**
 * 搶答順位策略（擴充點，constitution 原則 IV）：課程已知延伸功能「更公平的搶答順位機制」
 * 可以新增其他實作而不改動收件流程。核心階段只實作 FirstSubmissionStrategy。
 */
export interface RankingStrategy {
  /** 回傳排序後的作答紀錄，第一筆即為搶答成功 */
  rank(submissions: readonly Submission[]): Submission[];
}
