import { describe, expect, it } from 'vitest';
import { readySession } from '../helpers/builders.js';
import { createService } from '../helpers/serviceFactory.js';

describe('QuizSessionService.open / close（US2）', () => {
  it('待開始 → 開啟 → 結束，記錄時間', async () => {
    const { service } = await createService(readySession());
    const opened = await service.open();
    expect(opened.status).toBe('OPEN');
    expect(opened.openedAt).not.toBeNull();
    const closed = await service.close();
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedAt).not.toBeNull();
  });

  it('重複開啟或結束回 ALREADY_IN_STATE，狀態不變', async () => {
    const { service } = await createService(readySession({ status: 'OPEN' }));
    await expect(service.open()).rejects.toMatchObject({ code: 'ALREADY_IN_STATE' });
    await service.close();
    await expect(service.close()).rejects.toMatchObject({ code: 'ALREADY_IN_STATE' });
    expect(service.getSession().status).toBe('CLOSED');
  });

  it('已結束後不能重新開啟；尚未匯入不能開啟', async () => {
    const closed = await createService(readySession({ status: 'CLOSED' }));
    await expect(closed.service.open()).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    const empty = await createService();
    await expect(empty.service.open()).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await expect(empty.service.close()).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});
