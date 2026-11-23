import { describe, expect, it } from 'vitest';
import { AsyncMutex } from '../../src/domain/mutex.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('AsyncMutex', () => {
  it('依呼叫順序執行，不會交錯', async () => {
    const mutex = new AsyncMutex();
    const log: string[] = [];
    await Promise.all(
      [30, 10, 0].map((delay, i) =>
        mutex.runExclusive(async () => {
          log.push(`start-${i}`);
          await sleep(delay);
          log.push(`end-${i}`);
        }),
      ),
    );
    expect(log).toEqual(['start-0', 'end-0', 'start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('前一個操作拋出例外時不會卡死', async () => {
    const mutex = new AsyncMutex();
    await expect(
      mutex.runExclusive(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(mutex.runExclusive(() => 'ok')).resolves.toBe('ok');
  });
});
