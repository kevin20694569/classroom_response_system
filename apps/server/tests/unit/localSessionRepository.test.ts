import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LocalSessionRepository,
  PersistedDataError,
} from '../../src/infrastructure/persistence/localSessionRepository.js';
import { readySession, submission } from '../helpers/builders.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'crs-repo-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('LocalSessionRepository', () => {
  it('檔案不存在時回傳 null', async () => {
    expect(await new LocalSessionRepository(path.join(dir, 'nested')).load()).toBeNull();
  });

  it('保存後可完整載入，且自動建立目錄', async () => {
    const repo = new LocalSessionRepository(path.join(dir, 'nested'));
    const session = readySession({
      status: 'OPEN',
      submissions: [submission(1, 1, 1)],
      nextSequence: 2,
    });
    await repo.save(session);
    expect(await repo.load()).toEqual(session);
  });

  it('保存後不留下暫存檔，內容包含 schemaVersion', async () => {
    const repo = new LocalSessionRepository(dir);
    await repo.save(readySession());
    const raw = JSON.parse(await readFile(path.join(dir, 'session.json'), 'utf8')) as {
      schemaVersion: number;
    };
    expect(raw.schemaVersion).toBe(1);
    await expect(readFile(path.join(dir, 'session.json.tmp'), 'utf8')).rejects.toThrow();
  });

  it('格式錯誤時拋出錯誤且不覆蓋原檔', async () => {
    const file = path.join(dir, 'session.json');
    await writeFile(file, '{"schemaVersion":1,"session":{"status":"WRONG"}}', 'utf8');
    const repo = new LocalSessionRepository(dir);
    await expect(repo.load()).rejects.toBeInstanceOf(PersistedDataError);
    expect(await readFile(file, 'utf8')).toContain('WRONG');
  });

  it('不是 JSON 時拋出錯誤', async () => {
    await writeFile(path.join(dir, 'session.json'), 'not json', 'utf8');
    await expect(new LocalSessionRepository(dir).load()).rejects.toBeInstanceOf(PersistedDataError);
  });
});

describe('LocalSessionRepository — 006 舊保存檔相容（research R1）', () => {
  it('送出紀錄沒有 submitterMemberId 的舊檔可以載入，該欄位為 null', async () => {
    const legacy = submission(1, 1, 1, ['答案'], 'Milo');
    const { submitterMemberId: _omitted, ...withoutMemberId } = legacy;
    const session = readySession({
      status: 'OPEN',
      submissions: [legacy],
      nextSequence: 2,
    });
    const file = path.join(dir, 'session.json');
    await writeFile(
      file,
      JSON.stringify({ schemaVersion: 1, session: { ...session, submissions: [withoutMemberId] } }),
      'utf8',
    );
    const loaded = await new LocalSessionRepository(dir).load();
    expect(loaded?.submissions[0]?.submitterMemberId).toBeNull();
    expect(loaded?.submissions[0]?.submitterNickname).toBe('Milo');
  });
});
