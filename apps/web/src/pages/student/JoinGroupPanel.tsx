import type { Group, GroupHeadcount, SessionStatus } from '@crs/shared';
import { useState } from 'react';
import { ApiError } from '../../api/http';
import { Button } from '../../ui/Button';
import { groupIdentity } from '../../ui/groupIdentity';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/icons';
import { ON_COLOR } from '../../ui/theme';

export interface JoinGroupPanelProps {
  status: SessionStatus;
  groups: readonly Group[];
  /** 各組目前的人數（004 FR-009） */
  headcounts: readonly GroupHeadcount[];
  /** 身分失效的說明（research R4） */
  notice: string | null;
  /** 目前已確認的暱稱（004 FR-008） */
  nickname: string;
  /** 回到暱稱頁修改暱稱（004 FR-007：只在尚未加入組別時提供） */
  onEditNickname: () => void;
  onJoin: (groupId: number) => Promise<void>;
}

/** 等待匯入／選擇組別（003 FR-001、FR-002；004 contracts/student-ui.md §2）。 */
export function JoinGroupPanel({
  status,
  groups,
  headcounts,
  notice,
  nickname,
  onEditNickname,
  onJoin,
}: JoinGroupPanelProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(groupId: number) {
    setPending(true);
    setError(null);
    try {
      await onJoin(groupId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加入失敗，請再試一次。');
      setPending(false);
    }
  }

  return (
    <main className="mx-auto mt-16 max-w-md space-y-4 p-6 text-center">
      <h1 className="text-3xl font-black text-ink">課堂搶答 — 學生端</h1>
      <p className="flex flex-wrap items-center justify-center gap-3 font-bold text-ink">
        <span>暱稱：{nickname}</span>
        <Button variant="secondary" size="sm" onClick={onEditNickname} disabled={pending}>
          修改暱稱
        </Button>
      </p>
      {notice !== null && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">
          {notice}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">
          {error}
        </p>
      )}
      {status === 'NOT_IMPORTED' ? (
        <EmptyState icon="notImported" message="老師尚未匯入題目，請稍候" animated />
      ) : (
        <section aria-label="選擇組別" className="space-y-3">
          <p className="font-semibold text-ink-muted">請選擇你的組別</p>
          <div className="grid grid-cols-2 gap-3">
            {groups.map((group) => {
              // 每組按鈕為各自的組別色、白字，含組別圖示（007 FR-009）；可存取名稱仍為「第 N 組」
              const { color, icon } = groupIdentity(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-label={group.name}
                  disabled={pending}
                  onClick={() => {
                    void join(group.id);
                  }}
                  style={{ backgroundColor: color, color: ON_COLOR }}
                  className="flex flex-col items-center gap-1 rounded-2xl px-4 py-4 font-black shadow-card transition hover:-translate-y-1 hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transform-none"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-white/20">
                    <Icon name={icon} size={26} />
                  </span>
                  <span className="block text-lg">{group.name}</span>
                  <span className="block text-sm font-bold">
                    已加入：{headcounts.find((h) => h.groupId === group.id)?.memberCount ?? 0} 人
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
