import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/config.js';

const valid = {
  TEACHER_PASSWORD: 'teacher-pass-123',
  SESSION_SECRET: 's'.repeat(40),
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/tmp/key.json',
};

describe('loadConfig', () => {
  it('讀取有效設定並套用預設值', () => {
    const config = loadConfig(valid);
    expect(config.port).toBe(3000);
    expect(config.dataDir).toBe('./data');
    expect(config.teacherPassword).toBe('teacher-pass-123');
  });

  it('空字串的選填變數使用預設值', () => {
    expect(loadConfig({ ...valid, PORT: '', DATA_DIR: '' }).port).toBe(3000);
  });

  it('缺少必填變數時列出變數名稱', () => {
    const { TEACHER_PASSWORD: _omit, ...rest } = valid;
    try {
      loadConfig(rest);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toContain('TEACHER_PASSWORD');
    }
  });

  it('密碼與密鑰太短、金鑰路徑不是絕對路徑時失敗', () => {
    expect(() =>
      loadConfig({
        TEACHER_PASSWORD: 'short',
        SESSION_SECRET: 'tiny',
        GOOGLE_SERVICE_ACCOUNT_KEY_FILE: 'relative/key.json',
      }),
    ).toThrow(ConfigError);
  });

  it('錯誤訊息不包含變數值', () => {
    const secretLike = 'tooShortValue';
    try {
      loadConfig({ ...valid, SESSION_SECRET: secretLike });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain('SESSION_SECRET');
      expect((error as Error).message).not.toContain(secretLike);
    }
  });
});
