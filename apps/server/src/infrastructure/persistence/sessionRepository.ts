import type { QuizSession } from '@crs/shared';

/**
 * 活動資料保存介面（FR-028）。
 * 正式環境使用 LocalSessionRepository（本機 JSON 檔）；測試使用記憶體版本。
 */
export interface SessionRepository {
  /** 沒有保存過資料時回傳 null */
  load(): Promise<QuizSession | null>;
  save(session: QuizSession): Promise<void>;
}
