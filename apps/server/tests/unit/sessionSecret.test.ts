import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveSessionSecret, SESSION_SECRET_MIN_LENGTH } from '../../src/config/sessionSecret.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'crs-secret-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('resolveSessionSecret', () => {
  it('環境變數有填時直接使用，不寫任何檔案', async () => {
    const configured = 'c'.repeat(40);
    expect(await resolveSessionSecret(configured, dir)).toBe(configured);
    expect(await readdir(dir)).toEqual([]);
  });

  it('沒填時自動產生足夠長的隨機密鑰並保存，目錄不存在也會建立', async () => {
    const dataDir = path.join(dir, 'nested', 'data');
    const secret = await resolveSessionSecret(undefined, dataDir);
    expect(secret.length).toBeGreaterThanOrEqual(SESSION_SECRET_MIN_LENGTH);
    expect(await readFile(path.join(dataDir, 'session-secret'), 'utf8')).toBe(`${secret}\n`);
  });

  it('重啟後讀回同一把密鑰，讓既有 token 仍然有效', async () => {
    const first = await resolveSessionSecret(undefined, dir);
    expect(await resolveSessionSecret(undefined, dir)).toBe(first);
  });

  it('不同資料目錄各自產生不同的密鑰', async () => {
    const other = await mkdtemp(path.join(tmpdir(), 'crs-secret-'));
    try {
      expect(await resolveSessionSecret(undefined, dir)).not.toBe(
        await resolveSessionSecret(undefined, other),
      );
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });

  it('保存的內容太短或是空的，視為無效並重新產生', async () => {
    await writeFile(path.join(dir, 'session-secret'), 'tiny\n', 'utf8');
    const secret = await resolveSessionSecret(undefined, dir);
    expect(secret).not.toBe('tiny');
    expect(secret.length).toBeGreaterThanOrEqual(SESSION_SECRET_MIN_LENGTH);
    expect(await resolveSessionSecret(undefined, dir)).toBe(secret);
  });

  it('環境變數有填時優先於已保存的密鑰', async () => {
    await resolveSessionSecret(undefined, dir);
    const configured = 'e'.repeat(40);
    expect(await resolveSessionSecret(configured, dir)).toBe(configured);
  });
});
