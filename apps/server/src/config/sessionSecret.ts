import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SESSION_SECRET_MIN_LENGTH = 32;

/** 自動產生的密鑰保存在資料目錄（已被 .gitignore 排除），與活動資料檔 session.json 分開。 */
const SECRET_FILE_NAME = 'session-secret';

/**
 * 取得簽章 token 用的密鑰：
 * 1. 環境變數有填 SESSION_SECRET → 直接使用，不碰檔案。
 * 2. 沒填 → 讀取 DATA_DIR 下保存的密鑰，讓伺服器重啟後既有 token 仍有效（FR-003a）。
 * 3. 還沒有（或保存的內容不合格）→ 產生新的隨機密鑰並保存，檔案權限限本人讀寫。
 */
export async function resolveSessionSecret(
  configured: string | undefined,
  dataDir: string,
): Promise<string> {
  if (configured !== undefined) return configured;

  const file = path.join(dataDir, SECRET_FILE_NAME);
  const stored = await readStoredSecret(file);
  if (stored !== null) return stored;

  const generated = randomBytes(32).toString('hex');
  await mkdir(dataDir, { recursive: true });
  await writeFile(file, `${generated}\n`, { encoding: 'utf8', mode: 0o600 });
  return generated;
}

async function readStoredSecret(file: string): Promise<string | null> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const secret = raw.trim();
  return secret.length >= SESSION_SECRET_MIN_LENGTH ? secret : null;
}
