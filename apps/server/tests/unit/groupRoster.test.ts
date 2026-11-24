import { describe, expect, it } from 'vitest';
import {
  GroupRoster,
  type RosterChange,
  type RosterTimers,
  type TimerHandle,
} from '../../src/domain/roster/groupRoster.js';

/** 手動推進的假計時器：advance(ms) 執行到期的回呼。 */
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; callback: () => void }>();
  const timers: RosterTimers = {
    setTimeout: (callback, ms) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, { at: now + ms, callback });
      return id as unknown as TimerHandle;
    },
    clearTimeout: (handle) => {
      pending.delete(handle as unknown as number);
    },
  };
  const advance = (ms: number): void => {
    now += ms;
    for (const [id, timer] of [...pending.entries()].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at > now) continue;
      pending.delete(id);
      timer.callback();
    }
  };
  return { timers, advance, pendingCount: () => pending.size };
}

const GROUPS = [1, 2, 3].map((id) => ({ id, name: `第 ${id} 組` }));

function setup() {
  const clock = fakeTimers();
  const roster = new GroupRoster({ graceMs: 30_000, timers: clock.timers });
  const changes: RosterChange[] = [];
  roster.onChange((change) => changes.push(change));
  return { roster, clock, changes };
}

describe('GroupRoster（004 FR-009～FR-015、research R4）', () => {
  it('第一次連線加入名冊並通知變更', () => {
    const { roster, changes } = setup();
    roster.connected('m1', 1, 'Milo');
    expect(roster.membersOf(1)).toEqual([{ memberId: 'm1', nickname: 'Milo' }]);
    expect(changes).toEqual([{ kind: 'joined', memberId: 'm1', groupId: 1 }]);
  });

  it('同一 memberId 兩個連線只算一位，也不重複通知', () => {
    const { roster, changes } = setup();
    roster.connected('m1', 1, 'Milo');
    roster.connected('m1', 1, 'Milo');
    expect(roster.headcounts(GROUPS)[0]).toEqual({ groupId: 1, memberCount: 1 });
    expect(changes).toHaveLength(1);
    // 關閉其中一個連線，另一個仍在：不啟動移除
    roster.disconnected('m1');
    expect(roster.membersOf(1)).toHaveLength(1);
  });

  it('連線數歸零後 29 秒仍在名冊，30 秒時移除並通知', () => {
    const { roster, clock, changes } = setup();
    roster.connected('m1', 2, 'Milo');
    roster.disconnected('m1');
    clock.advance(29_000);
    expect(roster.membersOf(2)).toHaveLength(1);
    clock.advance(1_000);
    expect(roster.membersOf(2)).toHaveLength(0);
    expect(changes.at(-1)).toEqual({ kind: 'removed', memberId: 'm1', groupId: 2 });
  });

  it('30 秒內重新連線取消移除，加入順序不變且不通知', () => {
    const { roster, clock, changes } = setup();
    roster.connected('m1', 1, 'Milo');
    roster.connected('m2', 1, 'Ava');
    roster.disconnected('m1');
    clock.advance(10_000);
    roster.connected('m1', 1, 'Milo');
    clock.advance(60_000);
    expect(roster.membersOf(1).map((m) => m.memberId)).toEqual(['m1', 'm2']);
    expect(changes.map((c) => c.kind)).toEqual(['joined', 'joined']);
    expect(clock.pendingCount()).toBe(0);
  });

  it('離開組別立即移除並記為已離開，之後再連線不會加入', () => {
    const { roster, changes } = setup();
    roster.connected('m1', 1, 'Milo');
    roster.leave('m1', 1);
    expect(roster.membersOf(1)).toHaveLength(0);
    expect(roster.hasLeft('m1')).toBe(true);
    expect(changes.at(-1)).toEqual({ kind: 'left', memberId: 'm1', groupId: 1 });
    roster.connected('m1', 1, 'Milo');
    expect(roster.membersOf(1)).toHaveLength(0);
  });

  it('緩衝中離開組別會取消計時器', () => {
    const { roster, clock } = setup();
    roster.connected('m1', 1, 'Milo');
    roster.disconnected('m1');
    roster.leave('m1', 1);
    expect(clock.pendingCount()).toBe(0);
  });

  it('清空名冊、已離開集合與計時器，並通知一次', () => {
    const { roster, clock, changes } = setup();
    roster.connected('m1', 1, 'Milo');
    roster.connected('m2', 2, 'Ava');
    roster.disconnected('m2');
    roster.leave('m1', 1);
    roster.clear();
    expect(roster.headcounts(GROUPS).map((h) => h.memberCount)).toEqual([0, 0, 0]);
    expect(roster.hasLeft('m1')).toBe(false);
    expect(clock.pendingCount()).toBe(0);
    expect(changes.filter((c) => c.kind === 'cleared')).toHaveLength(1);
  });

  it('各組人數：沒有人的組別為 0；緩衝中的組員仍計入', () => {
    const { roster } = setup();
    roster.connected('a', 1, 'A');
    roster.connected('b', 1, 'B');
    roster.connected('c', 2, 'C');
    roster.disconnected('c');
    expect(roster.headcounts(GROUPS)).toEqual([
      { groupId: 1, memberCount: 2 },
      { groupId: 2, memberCount: 1 },
      { groupId: 3, memberCount: 0 },
    ]);
  });

  it('本組成員依加入先後排序，暱稱相同時都列出', () => {
    const { roster } = setup();
    roster.connected('m3', 2, 'Milo');
    roster.connected('m1', 2, 'Ava');
    roster.connected('m2', 2, 'Milo');
    roster.connected('x', 1, 'Leo');
    expect(roster.membersOf(2)).toEqual([
      { memberId: 'm3', nickname: 'Milo' },
      { memberId: 'm1', nickname: 'Ava' },
      { memberId: 'm2', nickname: 'Milo' },
    ]);
  });

  it('30 人的組別完整列出', () => {
    const { roster } = setup();
    for (let i = 1; i <= 30; i += 1) roster.connected(`m${i}`, 1, `S${i}`);
    expect(roster.membersOf(1)).toHaveLength(30);
    expect(roster.headcounts(GROUPS)[0]?.memberCount).toBe(30);
  });
});
