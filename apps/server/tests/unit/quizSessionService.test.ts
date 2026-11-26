import { describe, expect, it, vi } from 'vitest';
import { CSV_EXPORT_NOT_CLOSED_MESSAGE } from '@crs/shared';
import { readySession, singleQuestion, submission } from '../helpers/builders.js';
import { createService } from '../helpers/serviceFactory.js';

describe('QuizSessionService.mutate', () => {
  it('保存成功後才替換狀態、版本加一並通知', async () => {
    const { service, repository } = await createService();
    const listener = vi.fn();
    service.onChange(listener);
    const next = readySession();
    await service.mutate(() => ({ next, result: undefined, changes: [{ kind: 'state' }] }));
    expect(service.getSession()).toBe(next);
    expect(service.getVersion()).toBe(1);
    expect(repository.saved).toEqual(next);
    expect(listener).toHaveBeenCalledWith([{ kind: 'state' }], 1);
  });

  it('保存失敗時狀態與版本不變，也不觸發通知（FR-028）', async () => {
    const { service, repository } = await createService();
    const before = service.getSession();
    const listener = vi.fn();
    service.onChange(listener);
    repository.failNextSave = true;
    await expect(
      service.mutate(() => ({
        next: readySession(),
        result: undefined,
        changes: [{ kind: 'state' }],
      })),
    ).rejects.toThrow('模擬保存失敗');
    expect(service.getSession()).toBe(before);
    expect(service.getVersion()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('回呼回傳原狀態時不保存也不通知', async () => {
    const { service, repository } = await createService();
    const listener = vi.fn();
    service.onChange(listener);
    const result = await service.mutate((current) => ({ next: current, result: 42, changes: [] }));
    expect(result).toBe(42);
    expect(repository.saveCount).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('啟動時從保存庫恢復狀態', async () => {
    const saved = readySession();
    const { service } = await createService(saved);
    expect(service.getSession()).toEqual(saved);
  });
});

describe('QuizSessionService.exportCsv（子功能 005，FR-004、FR-015）', () => {
  const closedSession = () =>
    readySession({
      status: 'CLOSED',
      openedAt: '2026-11-26T02:32:15.123Z',
      closedAt: '2026-11-26T02:40:00.000Z',
      questions: [singleQuestion(1)],
      submissions: [submission(1, 1, 1, ['機密答案'], '機密暱稱')],
    });

  it('CLOSED 時回傳 CsvExport，且不保存、不推播、不改狀態與版本', async () => {
    const initial = closedSession();
    const { service, repository } = await createService(initial);
    const listener = vi.fn();
    service.onChange(listener);
    const sessionBefore = service.getSession();

    const exported = await service.exportCsv();

    expect(exported.rowCount).toBe(1);
    expect(exported.fileName).toBe('搶答結果_20261126-1032.csv');
    expect(service.getVersion()).toBe(0);
    expect(service.getSession()).toBe(sessionBefore);
    expect(service.getSession().lastExport).toBeNull();
    expect(repository.saveCount).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('成功時 log 只有事件與列數，不含答案與暱稱', async () => {
    const entries: object[] = [];
    const logger = {
      info: (obj: object) => entries.push(obj),
      warn: (obj: object) => entries.push(obj),
      error: (obj: object) => entries.push(obj),
    };
    const { service } = await createService(closedSession(), logger);
    await service.exportCsv();
    expect(entries).toEqual([{ event: 'csv_export.succeeded', rowCount: 1 }]);
    expect(JSON.stringify(entries)).not.toContain('機密');
  });
});

describe('QuizSessionService.exportCsv（非 CLOSED 一律拒絕，FR-003、FR-014）', () => {
  it.each(['NOT_IMPORTED', 'READY', 'OPEN'] as const)(
    '%s 時丟出 INVALID_TRANSITION，log 記錄 csv_export.failed',
    async (status) => {
      const entries: object[] = [];
      const logger = {
        info: (obj: object) => entries.push(obj),
        warn: (obj: object) => entries.push(obj),
        error: (obj: object) => entries.push(obj),
      };
      const initial = status === 'NOT_IMPORTED' ? null : readySession({ status });
      const { service } = await createService(initial, logger);
      await expect(service.exportCsv()).rejects.toMatchObject({
        code: 'INVALID_TRANSITION',
        message: CSV_EXPORT_NOT_CLOSED_MESSAGE,
      });
      expect(entries).toEqual([{ event: 'csv_export.failed', code: 'INVALID_TRANSITION' }]);
    },
  );
});
