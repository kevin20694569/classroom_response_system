import { describe, expect, it, vi } from 'vitest';
import { readySession, submission } from '../helpers/builders.js';
import { loadFixture } from '../helpers/fixtures.js';
import { createService } from '../helpers/serviceFactory.js';

const SINGLE_URL = 'https://docs.google.com/spreadsheets/d/single-doc/edit#gid=1';
const GROUP_URL = 'https://docs.google.com/spreadsheets/d/group-doc/edit';
const BAD_URL = 'https://docs.google.com/spreadsheets/d/bad-doc/edit';

async function setup(initial = null as Parameters<typeof createService>[0]) {
  const fixture = await createService(initial);
  fixture.gateway.set('single-doc', loadFixture('single-example'));
  fixture.gateway.set('group-doc', loadFixture('group-example'));
  fixture.gateway.set('bad-doc', loadFixture('invalid-number'));
  return fixture;
}

describe('QuizSessionService.importQuestions（US1）', () => {
  it('匯入兩份範例分別得到 6 題與 4 題，狀態變為待開始', async () => {
    const { service } = await setup();
    const single = await service.importQuestions({ spreadsheetUrl: SINGLE_URL, groupCount: 3 });
    expect(single.status).toBe('READY');
    expect(single.questions).toHaveLength(6);
    expect(single.groups.map((g) => g.name)).toEqual(['第 1 組', '第 2 組', '第 3 組']);
    expect(single.source).toEqual({ spreadsheetId: 'single-doc', sheetTitle: '學習單' });

    const group = await service.importQuestions({ spreadsheetUrl: GROUP_URL, groupCount: 2 });
    expect(group.questions.map((q) => q.kind)).toEqual(['group', 'group', 'single', 'single']);
    expect(group.activityId).not.toBe(single.activityId);
  });

  it('格式錯誤時資料完全不變，也不保存', async () => {
    const { service, repository } = await setup();
    await service.importQuestions({ spreadsheetUrl: SINGLE_URL, groupCount: 2 });
    const before = service.getSession();
    const saves = repository.saveCount;
    await expect(
      service.importQuestions({ spreadsheetUrl: BAD_URL, groupCount: 2 }),
    ).rejects.toMatchObject({ code: 'GUIDED_NOTES_INVALID' });
    expect(service.getSession()).toBe(before);
    expect(repository.saveCount).toBe(saves);
  });

  it('無法存取文件時回 SHEETS_UNAVAILABLE，資料不變', async () => {
    const { service, gateway } = await setup();
    gateway.failNext = true;
    await expect(
      service.importQuestions({ spreadsheetUrl: SINGLE_URL, groupCount: 2 }),
    ).rejects.toMatchObject({ code: 'SHEETS_UNAVAILABLE' });
    expect(service.getSession().status).toBe('NOT_IMPORTED');
  });

  it('網址無效時回 INVALID_SPREADSHEET_URL，不讀取文件', async () => {
    const { service, gateway } = await setup();
    await expect(
      service.importQuestions({ spreadsheetUrl: 'https://example.com', groupCount: 2 }),
    ).rejects.toMatchObject({ code: 'INVALID_SPREADSHEET_URL' });
    expect(gateway.readCount).toBe(0);
  });

  it('搶答進行中時拒絕匯入', async () => {
    const { service } = await setup(readySession({ status: 'OPEN' }));
    await expect(
      service.importQuestions({ spreadsheetUrl: SINGLE_URL, groupCount: 2 }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('已結束後未確認時回 CONFIRM_DISCARD_REQUIRED，確認後清除作答開始新的一場', async () => {
    const closed = readySession({
      status: 'CLOSED',
      submissions: [submission(1, 1, 1)],
      nextSequence: 2,
    });
    const { service } = await setup(closed);
    await expect(
      service.importQuestions({ spreadsheetUrl: SINGLE_URL, groupCount: 2 }),
    ).rejects.toMatchObject({ code: 'CONFIRM_DISCARD_REQUIRED' });

    const next = await service.importQuestions({
      spreadsheetUrl: SINGLE_URL,
      groupCount: 2,
      confirmDiscard: true,
    });
    expect(next.status).toBe('READY');
    expect(next.submissions).toEqual([]);
    expect(next.nextSequence).toBe(1);
    expect(next.lastExport).toBeNull();
    expect(next.activityId).not.toBe(closed.activityId);
  });

  it('待開始時重新匯入會取代題目與組數，並觸發學生身分重置', async () => {
    const { service } = await setup();
    await service.importQuestions({ spreadsheetUrl: SINGLE_URL, groupCount: 2 });
    const listener = vi.fn();
    service.onChange(listener);
    const next = await service.importQuestions({ spreadsheetUrl: GROUP_URL, groupCount: 5 });
    expect(next.questions).toHaveLength(4);
    expect(next.groups).toHaveLength(5);
    expect(listener).toHaveBeenCalledWith([{ kind: 'reset' }, { kind: 'state' }], 2);
  });
});
