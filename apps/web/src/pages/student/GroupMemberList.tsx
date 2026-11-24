import type { GroupMember } from '@crs/shared';
import { useId } from 'react';

export interface GroupMemberListProps {
  /** 本組成員，伺服器已依加入先後排列 */
  members: readonly GroupMember[];
  /** 本分頁的組員身分，用來標示「（你）」 */
  selfMemberId: string;
}

/**
 * 本組成員名單（004 FR-010、contracts/student-ui.md §3）：作答與結果畫面都顯示。
 * 暱稱相同的成員分別列出；人數多時換行排列、不截斷。
 */
export function GroupMemberList({ members, selfMemberId }: GroupMemberListProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-xl bg-white p-4 shadow">
      <h2 id={headingId} className="text-sm font-medium text-slate-700">
        本組成員（{members.length} 人）
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {members.map((member) => (
          <li
            key={member.memberId}
            className={`rounded-full px-3 py-1 text-sm ${
              member.memberId === selfMemberId
                ? 'bg-indigo-100 font-medium text-indigo-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {member.nickname}
            {member.memberId === selfMemberId && '（你）'}
          </li>
        ))}
      </ul>
    </section>
  );
}
