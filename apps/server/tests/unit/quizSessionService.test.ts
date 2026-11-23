import { describe, expect, it, vi } from 'vitest';
import { readySession } from '../helpers/builders.js';
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
