import type { QuestionResult, QuizSession } from '@crs/shared';
import type { RankingStrategy } from './rankingStrategy.js';

/**
 * 推導每題結果：依順位策略排序後的第一筆為搶答成功（FR-017）；沒有作答為 null（無人搶答）。
 * 結果不另外保存，永遠由作答紀錄推導，避免兩份資料不一致。
 */
export function deriveResults(session: QuizSession, strategy: RankingStrategy): QuestionResult[] {
  return session.questions.map((question) => {
    const ranked = strategy.rank(
      session.submissions.filter((s) => s.questionNumber === question.number),
    );
    return { questionNumber: question.number, winner: ranked[0] ?? null };
  });
}
