import type { Group, GroupHeadcount, GroupId, GroupMember } from '@crs/shared';

/** 斷線後仍算在組內的緩衝時間（004 FR-012、Clarifications）。 */
export const ROSTER_GRACE_MS = 30_000;

/** 名冊中的一位組員（004 data-model §3）。 */
interface RosterEntry {
  memberId: string;
  groupId: GroupId;
  nickname: string;
  /** 第一次出現在名冊的順序；名冊依此排序，重連不改變 */
  joinedSeq: number;
  /** 該組員目前的連線數（同一分頁重新整理時新舊連線可能短暫重疊） */
  connections: number;
  /** 連線數歸零時啟動的移除計時器 */
  removeTimer: TimerHandle | null;
}

export type TimerHandle = ReturnType<typeof setTimeout>;

/** 計時器函式（測試可注入假的計時器驗證 30 秒緩衝）。 */
export interface RosterTimers {
  setTimeout: (callback: () => void, ms: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
}

/**
 * 名冊變更：joined（第一次加入）、removed（斷線超過緩衝時間）、left（離開組別）、cleared（新的活動）。
 * 006：另有連線狀態變更 disconnected（最後一個連線斷開、開始 30 秒緩衝）與 reconnected（緩衝期內重新連線），
 * 只影響老師端的「連線中斷」標示，人數與成員名單不變（FR-021）。
 * 同一組員多開分頁、或仍有其他連線時斷開其中一個，都不算變更。
 */
export type RosterChange =
  | {
      kind: 'joined' | 'removed' | 'left' | 'disconnected' | 'reconnected';
      memberId: string;
      groupId: GroupId;
    }
  | { kind: 'cleared' };

export type RosterListener = (change: RosterChange) => void;

/** 可見性政策只需要讀取人數、本組成員，以及（老師檢視用的）是否在斷線緩衝期。 */
export type RosterReader = Pick<GroupRoster, 'headcounts' | 'membersOf' | 'isInGrace'>;

export interface GroupRosterOptions {
  graceMs?: number;
  timers?: RosterTimers;
}

/**
 * 組員名冊（004 research R4）：依學生分頁的連線維護「誰在哪一組」。
 *
 * - 「在組內」以連線判斷：分頁連線中就算在組內；連線數歸零後保留 30 秒，期間重新連線視為同一位組員，
 *   不重複計算也不短暫消失（FR-012）。
 * - 離開組別（只在「待開始」）立即移除，並記在本次活動的「已離開」集合，之後同一身分視為失效。
 * - 名冊只在記憶體：它是連線狀態，不是活動資料，不寫入 data/session.json。伺服器重新啟動後名冊從空的開始，
 *   學生分頁自動重連時再依 token 中的 memberId、組別與暱稱重新加入（FR-013）。
 * - 新的活動時清空（FR-015）。
 *
 * 不依賴 Socket.IO：由傳輸層在連線、斷線時呼叫（原則 IV）。
 */
export class GroupRoster {
  private readonly entries = new Map<string, RosterEntry>();
  private readonly leftMemberIds = new Set<string>();
  private readonly listeners = new Set<RosterListener>();
  private readonly graceMs: number;
  private readonly timers: RosterTimers;
  private nextSeq = 1;

  constructor(options: GroupRosterOptions = {}) {
    this.graceMs = options.graceMs ?? ROSTER_GRACE_MS;
    this.timers = options.timers ?? {
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => {
        clearTimeout(handle);
      },
    };
  }

  onChange(listener: RosterListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 學生分頁連線：第一次出現就加入名冊；緩衝中重新連線則取消移除，加入順序不變。 */
  connected(memberId: string, groupId: GroupId, nickname: string): void {
    if (this.leftMemberIds.has(memberId)) return;
    const entry = this.entries.get(memberId);
    if (entry !== undefined) {
      entry.connections += 1;
      if (entry.removeTimer !== null) {
        this.timers.clearTimeout(entry.removeTimer);
        entry.removeTimer = null;
        // 緩衝期內重新連線：老師端的「連線中斷」標示要消失（006 FR-021）
        this.emit({ kind: 'reconnected', memberId, groupId: entry.groupId });
      }
      return;
    }
    this.entries.set(memberId, {
      memberId,
      groupId,
      nickname,
      joinedSeq: this.nextSeq,
      connections: 1,
      removeTimer: null,
    });
    this.nextSeq += 1;
    this.emit({ kind: 'joined', memberId, groupId });
  }

  /** 學生分頁斷線：連線數歸零後啟動緩衝計時，到期才移出名冊。 */
  disconnected(memberId: string): void {
    const entry = this.entries.get(memberId);
    if (entry === undefined) return;
    entry.connections = Math.max(0, entry.connections - 1);
    if (entry.connections > 0 || entry.removeTimer !== null) return;
    entry.removeTimer = this.timers.setTimeout(() => {
      // 計時期間可能已重連、離開或清空：只移除仍是同一筆且沒有連線的組員
      if (this.entries.get(memberId) !== entry || entry.connections > 0) return;
      this.entries.delete(memberId);
      this.emit({ kind: 'removed', memberId, groupId: entry.groupId });
    }, this.graceMs);
    // 所有分頁都斷線、開始緩衝：老師端標示「連線中斷」，仍計入人數（006 FR-021）
    this.emit({ kind: 'disconnected', memberId, groupId: entry.groupId });
  }

  /** 離開組別：立即移出名冊並記為已離開（呼叫端負責檢查只在「待開始」）。 */
  leave(memberId: string, groupId: GroupId): void {
    const entry = this.entries.get(memberId);
    if (entry?.removeTimer !== undefined && entry.removeTimer !== null) {
      this.timers.clearTimeout(entry.removeTimer);
    }
    this.entries.delete(memberId);
    this.leftMemberIds.add(memberId);
    this.emit({ kind: 'left', memberId, groupId: entry?.groupId ?? groupId });
  }

  /**
   * 是否在斷線緩衝期（006 FR-021）：仍在名冊、但所有分頁都已斷線、移除計時器正在倒數。
   * 老師端據此標示「連線中斷」；這段期間仍算在組內、計入人數（004 FR-012 不變）。
   */
  isInGrace(memberId: string): boolean {
    const entry = this.entries.get(memberId);
    return entry !== undefined && entry.connections === 0 && entry.removeTimer !== null;
  }

  hasLeft(memberId: string): boolean {
    return this.leftMemberIds.has(memberId);
  }

  /** 新的活動：清空名冊、已離開集合與所有計時器。 */
  clear(): void {
    for (const entry of this.entries.values()) {
      if (entry.removeTimer !== null) this.timers.clearTimeout(entry.removeTimer);
    }
    this.entries.clear();
    this.leftMemberIds.clear();
    this.nextSeq = 1;
    this.emit({ kind: 'cleared' });
  }

  /** 各組人數（「在組內」與「緩衝中」都計入）；沒有人的組別為 0。 */
  headcounts(groups: readonly Group[]): GroupHeadcount[] {
    const counts = new Map<GroupId, number>();
    for (const entry of this.entries.values()) {
      counts.set(entry.groupId, (counts.get(entry.groupId) ?? 0) + 1);
    }
    return groups.map((g) => ({ groupId: g.id, memberCount: counts.get(g.id) ?? 0 }));
  }

  /** 本組成員，依加入先後排列；暱稱相同的成員分別列出。 */
  membersOf(groupId: GroupId): GroupMember[] {
    return [...this.entries.values()]
      .filter((e) => e.groupId === groupId)
      .sort((a, b) => a.joinedSeq - b.joinedSeq)
      .map((e) => ({ memberId: e.memberId, nickname: e.nickname }));
  }

  private emit(change: RosterChange): void {
    for (const listener of this.listeners) listener(change);
  }
}
