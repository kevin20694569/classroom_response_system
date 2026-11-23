import type { Submission } from '@crs/shared';
import type { RankingStrategy } from './rankingStrategy.js';

/**
 * 預設順位：最先送出者成功。
 * 「先後」只看伺服器指派的 sequence（處理順序），不看 receivedAt 或任何客戶端時間（FR-016）。
 */
export class FirstSubmissionStrategy implements RankingStrategy {
  rank(submissions: readonly Submission[]): Submission[] {
    return [...submissions].sort((a, b) => a.sequence - b.sequence);
  }
}
