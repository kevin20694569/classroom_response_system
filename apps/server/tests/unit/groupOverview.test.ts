import { GroupOverviewSchema, groupName, type QuizSession } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { buildGroupOverview } from '../../src/domain/overview/groupOverview.js';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import { deriveResults } from '../../src/domain/ranking/results.js';
import { GroupRoster, type TimerHandle } from '../../src/domain/roster/groupRoster.js';
import { initialSession } from '../../src/domain/session/quizSession.js';
import { readySession, submission } from '../helpers/builders.js';

/** 不會到期的計時器：緩衝期一直持續，測試結束也不留下真正的計時器。 */
const frozenTimers = {
  setTimeout: (): TimerHandle => 0 as unknown as TimerHandle,
  clearTimeout: (): void => undefined,
};

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const strategy = new FirstSubmissionStrategy();

function fourGroups(overrides: Partial<QuizSession> = {}): QuizSession {
  return readySession({
    groups: [1, 2, 3, 4].map((g) => ({ id: g, name: groupName(g) })),
    ...overrides,
  });
}

function overview(session: QuizSession, roster: GroupRoster) {
  const result = buildGroupOverview(session, roster, deriveResults(session, strategy));
  // 每一組都必須符合共用契約的不變式
  for (const group of result) expect(GroupOverviewSchema.safeParse(group).success).toBe(true);
  return result;
}

describe('buildGroupOverview：組員名單（006 US1、FR-002～FR-004、FR-021）', () => {
  it('尚未匯入時沒有任何組別', () => {
    const session = initialSession();
    expect(session.status).toBe('NOT_IMPORTED');
    expect(overview(session, new GroupRoster({ timers: frozenTimers }))).toEqual([]);
  });

  it('依組別編號列出每一組，組員依加入先後，空組沒有成員', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(2), 1, 'Milo');
    roster.connected(id(1), 1, 'Ava');
    roster.connected(id(3), 2, 'Leo');
    const result = overview(fourGroups(), roster);
    expect(result.map((g) => g.groupId)).toEqual([1, 2, 3, 4]);
    expect(result[0]).toEqual({
      groupId: 1,
      memberCount: 2,
      members: [
        { memberId: id(2), nickname: 'Milo', inGroup: true, disconnected: false, answered: [] },
        { memberId: id(1), nickname: 'Ava', inGroup: true, disconnected: false, answered: [] },
      ],
    });
    expect(result[1]?.members.map((m) => m.nickname)).toEqual(['Leo']);
    expect(result[2]).toEqual({ groupId: 3, memberCount: 0, members: [] });
    expect(result[3]).toEqual({ groupId: 4, memberCount: 0, members: [] });
  });

  it('暱稱相同的組員分別列出', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'Milo');
    roster.connected(id(2), 1, 'Milo');
    const [first] = overview(fourGroups(), roster);
    expect(first?.memberCount).toBe(2);
    expect(first?.members.map((m) => [m.memberId, m.nickname])).toEqual([
      [id(1), 'Milo'],
      [id(2), 'Milo'],
    ]);
  });

  it('緩衝期內的組員標示連線中斷，仍計入人數', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'Milo');
    roster.connected(id(2), 1, 'Ava');
    roster.disconnected(id(2));
    const [first] = overview(fourGroups(), roster);
    expect(first?.memberCount).toBe(2);
    expect(first?.members.map((m) => m.disconnected)).toEqual([false, true]);
  });

  it('每組人數與學生端的 headcounts 一致', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'A');
    roster.connected(id(2), 3, 'B');
    roster.connected(id(3), 3, 'C');
    roster.disconnected(id(3));
    const session = fourGroups();
    expect(overview(session, roster).map((g) => g.memberCount)).toEqual(
      roster.headcounts(session.groups).map((h) => h.memberCount),
    );
  });
});

describe('buildGroupOverview：回答標註（006 US2、FR-007～FR-010）', () => {
  const open = (submissions: QuizSession['submissions']): QuizSession =>
    fourGroups({ status: 'OPEN', submissions, nextSequence: submissions.length + 1 });

  it('組員的題號依題號由小到大；沒有送出的組員沒有標註', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'Milo');
    roster.connected(id(2), 1, 'Ava');
    const session = open([
      submission(3, 1, 1, ['a', 'b'], 'Milo', id(1)),
      submission(1, 1, 2, ['c'], 'Milo', id(1)),
    ]);
    const [first] = overview(session, roster);
    expect(first?.members[0]?.answered.map((t) => t.questionNumber)).toEqual([1, 3]);
    expect(first?.members[1]?.answered).toEqual([]);
  });

  it('搶答成功只標在該題第一名的送出（與 deriveResults 一致）', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'Milo');
    roster.connected(id(2), 2, 'Leo');
    const session = open([
      submission(1, 1, 1, ['first'], 'Milo', id(1)),
      submission(1, 2, 2, ['second'], 'Leo', id(2)),
    ]);
    const result = overview(session, roster);
    expect(result[0]?.members[0]?.answered).toEqual([{ questionNumber: 1, isWinner: true }]);
    expect(result[1]?.members[0]?.answered).toEqual([{ questionNumber: 1, isWinner: false }]);
  });

  it('同組兩位「Milo」只有實際送出者有標註（依身分，不依暱稱）', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'Milo');
    roster.connected(id(2), 1, 'Milo');
    const [first] = overview(open([submission(2, 1, 1, ['x'], 'Milo', id(2))]), roster);
    expect(first?.members.map((m) => m.answered.length)).toEqual([0, 1]);
  });

  it('沒有送出者身分的舊紀錄不標註，也不產生不在組內的成員', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'Milo');
    const [first] = overview(open([submission(1, 1, 1, ['x'], 'Milo', null)]), roster);
    expect(first?.members).toHaveLength(1);
    expect(first?.members[0]?.answered).toEqual([]);
  });

  it('不在組內的送出者排在組員之後，依第一筆送出先後，暱稱取第一筆送出，不計入人數', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'Milo');
    const session = open([
      submission(2, 1, 1, ['x'], 'Ava', id(3)),
      submission(1, 1, 2, ['y'], 'Leo', id(4)),
      submission(3, 1, 3, ['a', 'b'], 'Ava', id(3)),
    ]);
    const [first] = overview(session, roster);
    expect(first?.memberCount).toBe(1);
    expect(first?.members).toEqual([
      { memberId: id(1), nickname: 'Milo', inGroup: true, disconnected: false, answered: [] },
      {
        memberId: id(3),
        nickname: 'Ava',
        inGroup: false,
        disconnected: false,
        answered: [
          { questionNumber: 2, isWinner: true },
          { questionNumber: 3, isWinner: true },
        ],
      },
      {
        memberId: id(4),
        nickname: 'Leo',
        inGroup: false,
        disconnected: false,
        answered: [{ questionNumber: 1, isWinner: true }],
      },
    ]);
  });

  it('不在組內的送出者沒有記錄暱稱時顯示「（未記錄暱稱）」', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    const [first] = overview(open([submission(1, 1, 1, ['x'], null, id(5))]), roster);
    expect(first?.members[0]).toMatchObject({ nickname: '（未記錄暱稱）', inGroup: false });
  });

  it('送出者重新回到名冊後恢復為一般組員，標註不變', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    const session = open([submission(1, 1, 1, ['x'], 'Ava', id(3))]);
    expect(overview(session, roster)[0]?.members[0]?.inGroup).toBe(false);
    roster.connected(id(3), 1, 'Ava');
    expect(overview(session, roster)[0]?.members).toEqual([
      {
        memberId: id(3),
        nickname: 'Ava',
        inGroup: true,
        disconnected: false,
        answered: [{ questionNumber: 1, isWinner: true }],
      },
    ]);
  });

  it('「待開始」時沒有任何標註', () => {
    const roster = new GroupRoster({ timers: frozenTimers });
    roster.connected(id(1), 1, 'Milo');
    for (const group of overview(fourGroups(), roster)) {
      for (const m of group.members) expect(m.answered).toEqual([]);
    }
  });
});
