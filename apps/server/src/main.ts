import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app.js';
import { ConfigError, loadConfig } from './config/config.js';
import { resolveSessionSecret } from './config/sessionSecret.js';
import { createLogger } from './infrastructure/logger.js';
import { LocalSessionRepository } from './infrastructure/persistence/localSessionRepository.js';
import {
  GoogleSheetsGateway,
  ServiceAccountKeyError,
} from './infrastructure/sheets/googleSheetsGateway.js';

/** 專案根目錄：src/main.ts 與 dist/main.js 都位於 apps/server/ 下一層。 */
const repoRoot = path.resolve(import.meta.dirname, '../../..');

/**
 * 進入點：載入設定 → 確認金鑰檔 → 恢復活動狀態 → 啟動伺服器。
 * 任何設定錯誤都以看得懂的訊息說明並中止啟動（constitution 原則 VIII）。
 */
async function main(): Promise<void> {
  const envFile = path.join(repoRoot, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const config = loadConfig(process.env);
  if (!existsSync(config.googleServiceAccountKeyFile)) {
    throw new ConfigError([
      'GOOGLE_SERVICE_ACCOUNT_KEY_FILE：找不到這個金鑰檔，請確認路徑（詳見 quickstart.md）',
    ]);
  }

  const dataDir = path.resolve(repoRoot, config.dataDir);
  const sessionSecret = await resolveSessionSecret(config.sessionSecret, dataDir);

  const logger = createLogger();
  const { app } = await buildApp({
    teacherPassword: config.teacherPassword,
    sessionSecret,
    gateway: new GoogleSheetsGateway(config.googleServiceAccountKeyFile, (error, operation) => {
      // 只記錄錯誤類型與狀態碼，不記錄金鑰路徑或回應內容
      const status = (error as { status?: unknown; code?: unknown }).status;
      logger.warn({ operation, status }, 'Google Sheets 存取失敗');
    }),
    repository: new LocalSessionRepository(dataDir),
    logger,
    webDistDir: path.join(repoRoot, 'apps/web/dist'),
  });

  await app.listen({ port: config.port, host: '127.0.0.1' });
  logger.info({ port: config.port }, `課堂搶答系統已啟動：http://localhost:${config.port}/teacher`);

  const shutdown = (): void => {
    void app.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError || error instanceof ServiceAccountKeyError) {
    console.error(error.message);
  } else {
    console.error(error instanceof Error ? error.message : '伺服器啟動失敗。');
  }
  process.exit(1);
});
