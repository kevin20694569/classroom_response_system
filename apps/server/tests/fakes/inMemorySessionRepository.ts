import type { QuizSession } from '@crs/shared';
import type { SessionRepository } from '../../src/infrastructure/persistence/sessionRepository.js';

/** 測試用的記憶體版保存庫；可設定讓下一次 save 失敗。 */
export class InMemorySessionRepository implements SessionRepository {
  saved: QuizSession | null = null;
  saveCount = 0;
  failNextSave = false;

  constructor(initial: QuizSession | null = null) {
    this.saved = initial === null ? null : structuredClone(initial);
  }

  load(): Promise<QuizSession | null> {
    return Promise.resolve(this.saved === null ? null : structuredClone(this.saved));
  }

  save(session: QuizSession): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      return Promise.reject(new Error('模擬保存失敗'));
    }
    this.saved = structuredClone(session);
    this.saveCount += 1;
    return Promise.resolve();
  }
}
