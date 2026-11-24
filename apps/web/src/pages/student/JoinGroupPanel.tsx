import type { Group, GroupHeadcount, SessionStatus } from '@crs/shared';
import { useState } from 'react';
import { ApiError } from '../../api/http';

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
      <h1 className="text-2xl font-bold">課堂搶答 — 學生端</h1>
      <p className="flex items-center justify-center gap-3 text-slate-700">
        <span>暱稱：{nickname}</span>
        <button
          type="button"
          onClick={onEditNickname}
          disabled={pending}
          className="text-sm text-indigo-700 underline disabled:opacity-50"
        >
          修改暱稱
        </button>
      </p>
      {notice !== null && (
        <p role="status" className="rounded-md bg-amber-50 p-3 text-amber-800">
          {notice}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {status === 'NOT_IMPORTED' ? (
        <p className="rounded-md bg-slate-100 p-4 text-slate-600">老師尚未匯入題目，請稍候</p>
      ) : (
        <section aria-label="選擇組別" className="space-y-3">
          <p className="text-slate-600">請選擇你的組別</p>
          <div className="grid grid-cols-2 gap-3">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-label={group.name}
                disabled={pending}
                onClick={() => {
                  void join(group.id);
                }}
                className="rounded-md bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                <span className="block">{group.name}</span>
                <span className="block text-sm font-normal text-indigo-100">
                  已加入：{headcounts.find((h) => h.groupId === group.id)?.memberCount ?? 0} 人
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
