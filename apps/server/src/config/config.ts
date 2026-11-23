import path from 'node:path';
import { z } from 'zod';

/**
 * 環境變數設定（constitution 原則 VIII）：啟動時集中讀取並驗證，缺少或格式錯誤就中止啟動。
 * 錯誤訊息只列出變數名稱與原因，不得包含變數值。
 */
const ConfigSchema = z.object({
  TEACHER_PASSWORD: z.string().min(8, '至少需要 8 個字'),
  SESSION_SECRET: z.string().min(32, '至少需要 32 個字'),
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE: z
    .string()
    .min(1, '必須填寫')
    .refine((p) => path.isAbsolute(p), '必須是完整的絕對路徑'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().min(1).default('./data'),
});

export interface AppConfig {
  teacherPassword: string;
  sessionSecret: string;
  googleServiceAccountKeyFile: string;
  port: number;
  dataDir: string;
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`設定檔錯誤，伺服器無法啟動：\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

/** 空字串視為未填寫，讓預設值生效。 */
function dropEmpty(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== '') result[key] = value;
  }
  return result;
}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const parsed = ConfigSchema.safeParse(dropEmpty(env));
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => {
      const name = issue.path.join('.') || '(未知變數)';
      const reason = issue.code === 'invalid_type' ? '缺少此變數' : issue.message;
      return `${name}：${reason}`;
    });
    throw new ConfigError(problems);
  }
  const c = parsed.data;
  return {
    teacherPassword: c.TEACHER_PASSWORD,
    sessionSecret: c.SESSION_SECRET,
    googleServiceAccountKeyFile: c.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    port: c.PORT,
    dataDir: c.DATA_DIR,
  };
}
