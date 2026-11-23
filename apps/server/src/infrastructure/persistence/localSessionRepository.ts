import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PersistedStateSchema, type PersistedState, type QuizSession } from '@crs/shared';
import type { SessionRepository } from './sessionRepository.js';

export class PersistedDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistedDataError';
  }
}

/**
 * 以單一 JSON 檔保存活動狀態（research R8）。
 * 寫入暫存檔後以 rename 原子替換，不會留下寫一半的檔案；資料檔不含 token、密碼或憑證。
 */
export class LocalSessionRepository implements SessionRepository {
  private readonly filePath: string;
  private readonly tempPath: string;

  constructor(private readonly dataDir: string) {
    this.filePath = path.join(dataDir, 'session.json');
    this.tempPath = path.join(dataDir, 'session.json.tmp');
  }

  async load(): Promise<QuizSession | null> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new PersistedDataError(
        '活動資料檔不是有效的 JSON，為避免資料遺失，伺服器不會覆蓋它。請檢查或移除 data/session.json 後再啟動。',
      );
    }
    const parsed = PersistedStateSchema.safeParse(json);
    if (!parsed.success) {
      // 不覆蓋原檔，避免資料遺失
      throw new PersistedDataError(
        '活動資料檔格式不正確，為避免資料遺失，伺服器不會覆蓋它。請檢查或移除 data/session.json 後再啟動。',
      );
    }
    return parsed.data.session;
  }

  async save(session: QuizSession): Promise<void> {
    const state: PersistedState = { schemaVersion: 1, session };
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(this.tempPath, this.filePath);
  }
}
