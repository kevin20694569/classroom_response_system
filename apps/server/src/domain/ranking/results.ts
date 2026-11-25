import type { QuestionResult, QuizSession } from '@crs/shared';
import type { RankingStrategy } from './rankingStrategy.js';

/**
 * 推導每題結果（結果不另外保存，永遠由作答紀錄推導，避免兩份資料不一致）：
 * - 「已結束」：老師勾選答對的送出中，依順位策略排序最前面的一筆為搶答成功；沒有答對為 null（無人答對）
 *   （004 FR-032，取代 001 FR-017 的「最先送出即搶答成功」）。匯出也使用這個結果（FR-027）。
 * - 其他階段（搶答進行中）：依順位策略排序後的第一筆為暫定第一名；沒有作答為 null。
 */
export function deriveResults(session: QuizSession, strategy: RankingStrategy): QuestionResult[] {
  const byGrading = session.status === 'CLOSED';
  return session.questions.map((question) => {
    const ranked = strategy.rank(
      session.submissions.filter((s) => s.questionNumber === question.number),
    );
    const candidates = byGrading ? ranked.filter((s) => s.correct) : ranked;
    return { questionNumber: question.number, winner: candidates[0] ?? null };
  });
}
