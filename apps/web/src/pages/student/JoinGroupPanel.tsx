import type { Group, SessionStatus } from '@crs/shared';
import { useState } from 'react';
import { ApiError } from '../../api/http';

export interface JoinGroupPanelProps {
  status: SessionStatus;
  groups: readonly Group[];
  /** 身分失效的說明（research R4） */
  notice: string | null;
  onJoin: (groupId: number) => Promise<void>;
}

/** 等待匯入／選擇組別（003 FR-001、FR-002、contracts/student-ui.md §1）。 */
export function JoinGroupPanel({ status, groups, notice, onJoin }: JoinGroupPanelProps) {
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
                disabled={pending}
                onClick={() => {
                  void join(group.id);
                }}
                className="rounded-md bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                {group.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
